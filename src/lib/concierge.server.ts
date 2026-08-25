/* ============================================================
   concierge.server — the generation half of the Ask feature,
   reachable only through chat.functions.ts's askConcierge.

   Ported from the old netlify/functions/ask.js (same grounding rules,
   same dual-provider dispatch, same key-never-leaves-the-server
   guarantee) and src/lib/ask.js's local composer, adapted for a real
   multi-turn contract: the browser sends `message` + `history`, never
   band context, so a crafted request cannot feed the model facts
   that are not in the catalogue. Retrieval re-runs here from the same
   listBands() the catalog route uses, so the concierge can never cite
   a band the UI is not also showing.

   A question that cannot be placed is not a dead end: instead of a
   structured "clarify" object (there is no chip UI on this contract,
   just a chat transcript), the concierge asks its follow-up as a
   normal assistant turn, in plain language. The caller folds it back
   into `history` and the next question resolves it.
   ============================================================ */

import { retrieve } from "./retrieve.js";
import { listBands } from "./catalog.server";

type ChatTurn = { role: "user" | "assistant"; content: string };
// `live` says whether a model actually generated this particular
// answer, as opposed to the deterministic local composer (no key
// configured, or the model call failed) — the UI uses it for the
// same honesty notice the rest of this app already carries.
type ConciergeAnswer = { answer: string; bandIds: string[]; caveat: string | null; live: boolean };

const GROQ_KEY = process.env["GROQ_API_KEY"];
const GROQ_URL = process.env["GROQ_BASE_URL"] || "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env["GROQ_MODEL"] || "openai/gpt-oss-120b";

const SYSTEM = `You answer questions about live wedding bands for BookMyBand, using ONLY the band records supplied in the user message.

Grounding rules — these are not style preferences:
- Never name a band, price, review, city or date that is not in the supplied records. If the records do not answer the question, say so plainly.
- Never state or imply a reliability judgement the records do not support. A band's tier is given; do not upgrade it because its reviews sound warm.
- "Limited info" means the evidence is insufficient, not that the band is fine. Say the evidence is thin and why. Do not soften this into "seems good" or "no complaints found".
- A "Flagged" band carries a credible report of a no-show, a substitution or a deposit dispute. Report it every time that band is mentioned, however many positive reviews it has. Never average it away, never bury it below the praise, and never present a flagged band as a safe pick.
- Quote a real reviewer when it supports the point, and attribute it.
- Prices are exact. Do not round, estimate or add figures together unless the record gives the total.

Answer vague questions; do not deflect them. "A good band", "a good destination band", "which is worth it" are real questions — answer with what the records support, name the strongest option and why, then say in one clause what would narrow it (a city, a budget, a style). Never reply with only a request for more detail.

Destination and outstation questions are about travel: lead with the outstation rate, whether there is a written contract, and whether the advance is refundable — those decide the risk once a band has to reach another city.

This is a conversation — earlier questions and answers may be included before the current one. Use them for context, but ground every claim only in the band records supplied now.

Tone: direct and concrete, like a knowledgeable friend who has read every review. Short paragraphs. No sales language, no emoji, no headings. Two to five sentences unless a comparison genuinely needs more.`;

const SCHEMA = {
  type: "object",
  properties: {
    answer: {
      type: "string",
      description: "The answer, grounded strictly in the supplied records.",
    },
    bandIds: {
      type: "array",
      items: { type: "string" },
      description: "ids of the bands the answer actually discusses, most relevant first. Empty if none apply.",
    },
    caveat: {
      type: ["string", "null"],
      description: "A warning the user must not miss — a flagged band, or evidence too thin to support a choice. Null when there is genuinely nothing to warn about.",
    },
  },
  required: ["answer", "bandIds", "caveat"],
  additionalProperties: false,
};

function userTurn(message: string, history: ChatTurn[], context: string): string {
  const prior = history
    .map((h) => `${h.role === "user" ? "Q" : "A"}: ${h.content}`)
    .join("\n");
  return (
    (prior ? `Earlier in this conversation:\n${prior}\n\n` : "") +
    `Question: ${message}\n\nBand records:\n\n${context}`
  );
}

/* Models sometimes wrap JSON in prose or a markdown fence. Take the
   outermost object rather than failing the whole request over it. */
function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a !== -1 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error("model did not return JSON");
}

async function generateGroq(message: string, history: ChatTurn[], context: string) {
  const res = await fetch(`${GROQ_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${SYSTEM}\n\nReply with a single JSON object and nothing else, matching this schema:\n${JSON.stringify(SCHEMA)}`,
        },
        { role: "user", content: userTurn(message, history, context) },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err: any = new Error(`Groq ${res.status}: ${detail.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "content_filter") {
    const e: any = new Error("refused");
    e.refusal = true;
    throw e;
  }
  return parseJson(choice?.message?.content || "");
}

async function generateClaude(message: string, history: ChatTurn[], context: string) {
  let Anthropic;
  try {
    ({ default: Anthropic } = await import("@anthropic-ai/sdk"));
  } catch {
    const e: any = new Error(
      "@anthropic-ai/sdk is not installed — run `npm i @anthropic-ai/sdk`, or set GROQ_API_KEY to use Groq instead.",
    );
    e.status = "missing_sdk";
    throw e;
  }
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  const response = await client.messages.create({
    model: process.env["ANTHROPIC_MODEL"] || "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SCHEMA },
    },
    system: SYSTEM,
    messages: [{ role: "user", content: userTurn(message, history, context) }],
  } as any);

  if ((response as any).stop_reason === "refusal") {
    const e: any = new Error("refused");
    e.refusal = true;
    throw e;
  }
  return parseJson((response as any).content.find((b: any) => b.type === "text")?.text || "");
}

/* ---------- local fallback ----------
   Not a fake model. States what was matched and what the records
   say, and abstains in exactly the cases the tiers abstain. Used
   whenever no model key is configured, so a portfolio link never
   goes dark for a missing key. */

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

function localAnswer(query: string, r: any): Omit<ConciergeAnswer, "live"> {
  const i = r.intent;
  const bits: string[] = [];
  if (i.destination) bits.push("a band that travels to your venue");
  if (i.city) bits.push(`in ${i.city}`);
  if (i.genres.length) bits.push(i.genres.join(" and "));
  if (i.budget) bits.push(`under ${inr(i.budget)}`);
  if (i.wantsCheap) bits.push("at the lower end");
  if (i.wantsBig) bits.push("a large line-up");
  if (i.wantsSmall) bits.push("a small line-up");
  if (i.wantsReliable) bits.push("with reliability evidence");
  else if (i.wantsGood) bits.push("worth booking, going on the evidence");
  const read = bits.length ? bits.join(", ") : "your wording";

  const lines = r.hits.map(({ band, a }: any) => {
    const price = inr(band.price.performance);
    const verdict =
      a.tier === "flagged"
        ? `flagged — ${a.headline}, and that is not cancelled out by the other reviews`
        : a.tier === "consistent"
          ? `${a.headline}`
          : a.tier === "mixed"
            ? `mixed — ${a.headline}`
            : `not enough evidence — ${a.headline}`;

    const extra: string[] = [];
    if (i.destination) {
      extra.push(
        typeof band.price.outstation === "number"
          ? `travels for ${inr(band.price.outstation)}`
          : "no outstation rate listed",
      );
      extra.push(band.price.contract ? "written contract" : "no written contract");
      extra.push(
        band.price.refundDays > 0
          ? `advance refundable up to ${band.price.refundDays} days before`
          : "advance non-refundable",
      );
    }

    return (
      `• ${band.name}, ${price} — ${verdict}.` + (extra.length ? `\n   ${extra.join(" · ")}.` : "")
    );
  });

  const flagged = r.hits.filter((h: any) => h.a.tier === "flagged");
  const thin = r.hits.filter((h: any) => h.a.tier === "limited");

  let caveat: string | null = null;
  if (flagged.length) {
    caveat =
      `${flagged.map((h: any) => h.band.name).join(" and ")} ${flagged.length > 1 ? "carry" : "carries"} a credible report of ` +
      `${[...new Set(flagged.flatMap((h: any) => h.a.flags.map((f: any) => f.flag)))].join(" and ")}. Shown deliberately — you are about to commit money you cannot get back.`;
  } else if (thin.length === r.hits.length) {
    caveat = `Every match here is below the ${r.hits[0].a.gate}-review evidence gate, so none of them has earned a trust claim either way.`;
  } else if (i.destination) {
    const noContract = r.hits.filter((h: any) => !h.band.price.contract);
    if (noContract.length) {
      caveat =
        `${noContract.map((h: any) => h.band.name).join(" and ")} ${noContract.length > 1 ? "have" : "has"} no written contract. ` +
        `For a band travelling to another city that is the term to push on before you pay an advance.`;
    }
  }

  const missing: string[] = [];
  if (!i.city) missing.push("a city");
  if (!i.budget && !i.wantsCheap) missing.push("a budget");
  if (!i.genres.length) missing.push("a style");
  const tail = missing.length
    ? `\n\nNarrow it with ${missing.slice(0, 2).join(" or ")} and this gets more useful.`
    : "";

  return {
    answer: `Reading that as: ${read}.\n\n${lines.join("\n")}${tail}`,
    bandIds: r.hits.map((h: any) => h.band.id),
    caveat,
  };
}

/* ---------- narrowing down ----------
   Asked as a plain assistant turn rather than a structured clarify
   object — there is no chip UI on this contract, just a transcript.
   The caller folds the reply back into `history` and the next
   message resolves it. Capped at two follow-ups: after that, show
   the best-evidenced bands rather than asking a third time. */

const CLARIFY = [
  {
    missing: (i: any) => !i.city,
    question: "Which city is the wedding in — Delhi NCR, Jaipur, Mumbai, Chandigarh, or Lucknow?",
  },
  {
    missing: (i: any) => !i.genres.length,
    question:
      "What should the band play — brass and dhol for the baraat, sufi and qawwali, Bollywood and retro, bhangra and pop, jazz, or a live orchestra?",
  },
  {
    missing: (i: any) => !i.budget && !i.wantsCheap,
    question: "Roughly what are you willing to spend on the band?",
  },
];

function nextClarify(intent: any) {
  return CLARIFY.find((c) => c.missing(intent)) || null;
}

export async function answerQuestion(message: string, history: ChatTurn[]): Promise<ConciergeAnswer> {
  const { bands } = await listBands();

  // Fold prior user turns into the query so retrieval reads the whole
  // conversation's constraints, not just the latest sentence.
  const priorAsks = history.filter((h) => h.role === "user").map((h) => h.content);
  const combinedQuery = [...priorAsks, message].join(". ");

  const r = retrieve(combinedQuery, { bands });
  const assistantTurns = history.filter((h) => h.role === "assistant").length;

  if (!r.grounded) {
    const clarify = nextClarify(r.intent);
    if (clarify && assistantTurns < 2) {
      return { answer: clarify.question, bandIds: [], caveat: null, live: false };
    }
    // Out of questions: show the best-evidenced bands rather than a
    // dead end.
    const best = retrieve("a good reliable band", { bands });
    const composed = localAnswer(message, best);
    return {
      ...composed,
      live: false,
      answer:
        "I could not tell what you were after from that, so here are the ones the reviews actually back — " +
        "the tiers are unchanged, and a flagged band is still shown as flagged.\n\n" +
        composed.answer.split("\n\n").slice(1).join("\n\n"),
    };
  }

  if (!GROQ_KEY && !process.env["ANTHROPIC_API_KEY"]) {
    return { ...localAnswer(message, r), live: false };
  }

  try {
    const out = GROQ_KEY
      ? await generateGroq(message, history, r.context)
      : await generateClaude(message, history, r.context);

    const known = new Set(r.hits.map((h: any) => h.band.id));
    return {
      answer: String(out.answer || ""),
      bandIds: (Array.isArray(out.bandIds) ? out.bandIds : []).filter((id: string) => known.has(id)),
      caveat: out.caveat ?? null,
      live: true,
    };
  } catch (err: any) {
    if (err.refusal) {
      return { answer: "That question could not be answered.", bandIds: [], caveat: null, live: false };
    }
    console.error("concierge generation failed, falling back to the local composer:", err);
    return { ...localAnswer(message, r), live: false };
  }
}
