/* ============================================================
   ask — the only place a model key exists.

   A static site cannot keep a secret, so the model call lives here.
   Retrieval is re-run server-side from the same seed module the app
   uses: the browser sends a question, never context, so a crafted
   request cannot feed the model facts that are not in the seed set.

   Two providers, picked by whichever key is present:

     GROQ_API_KEY       -> Groq, OpenAI-compatible chat/completions
     ANTHROPIC_API_KEY  -> Claude, Anthropic SDK

   Note for anyone tempted by the ANTHROPIC_BASE_URL trick: pointing
   the Anthropic SDK at Groq does not work. The SDK posts an
   Anthropic-shaped body to /v1/messages; Groq's /openai/v1 surface
   serves an OpenAI-shaped /chat/completions. Different wire formats,
   so it 404s. That env var works for the Claude Code CLI, which
   translates between providers — application code does not.

   Deploy: Netlify function. Set one of the keys above in the site's
   environment, and point the app at it with
   VITE_ASK_ENDPOINT=/.netlify/functions/ask
   ============================================================ */

import { retrieve } from "../../src/lib/retrieve.js";

const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

/* The abstention rules are the product, not a nicety: someone is
   about to pay a non-refundable deposit on the strength of this. */
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

const userTurn = (query, date, context) =>
  `Question: ${query}\n` + (date ? `Their date: ${date}\n` : "") +
  `\nBand records:\n\n${context}`;

/* Models sometimes wrap JSON in prose or a markdown fence. Take the
   outermost object rather than failing the whole request over it. */
function parseJson(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a !== -1 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new Error("model did not return JSON");
}

/* ---------- Groq: OpenAI-compatible chat/completions ----------
   Plain fetch, no SDK — the same call backend.js makes against
   Supabase, and one less dependency in a function that only ever
   makes one kind of request. */
async function generateGroq(query, date, context) {
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
        { role: "user", content: userTurn(query, date, context) },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`Groq ${res.status}: ${detail.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (choice?.finish_reason === "content_filter") {
    const e = new Error("refused"); e.refusal = true; throw e;
  }
  return parseJson(choice?.message?.content || "");
}

/* ---------- Claude ----------
   Imported lazily so a Groq-only deploy does not need the SDK
   installed at all. */
async function generateClaude(query, date, context) {
  let Anthropic;
  try {
    ({ default: Anthropic } = await import("@anthropic-ai/sdk"));
  } catch {
    const e = new Error("@anthropic-ai/sdk is not installed — run `npm i @anthropic-ai/sdk`, or set GROQ_API_KEY to use Groq instead.");
    e.status = "missing_sdk";
    throw e;
  }
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: SCHEMA },
    },
    system: SYSTEM,
    messages: [{ role: "user", content: userTurn(query, date, context) }],
  });

  if (response.stop_reason === "refusal") {
    const e = new Error("refused"); e.refusal = true; throw e;
  }
  return parseJson(response.content.find((b) => b.type === "text")?.text || "");
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Use POST.", { status: 405 });
  }

  let query, date;
  try {
    ({ query, date } = await req.json());
  } catch {
    return new Response("Body must be JSON.", { status: 400 });
  }

  if (typeof query !== "string" || !query.trim()) {
    return new Response("A question is required.", { status: 400 });
  }
  if (query.length > 500) {
    return new Response("That question is too long — keep it under 500 characters.", { status: 400 });
  }

  const r = retrieve(query, { date: typeof date === "string" ? date : null });

  // Nothing matched: answer from here rather than paying for a model
  // call whose only honest output is "there is nothing to tell you".
  if (!r.grounded) {
    return Response.json({
      answer:
        "Nothing in the catalogue matches that. Try naming a city, a style (brass, sufi, jazz, bhangra, orchestra), " +
        "a budget, or ask which bands have actually shown up on the day.",
      bandIds: [],
      caveat: null,
    });
  }

  if (!GROQ_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error("neither GROQ_API_KEY nor ANTHROPIC_API_KEY is set");
    return new Response("The answer service is not configured.", { status: 500 });
  }

  try {
    const out = GROQ_KEY
      ? await generateGroq(query, date, r.context)
      : await generateClaude(query, date, r.context);

    // Never let a hallucinated id through to the UI as a band card.
    const known = new Set(r.hits.map((h) => h.band.id));
    return Response.json({
      answer: String(out.answer || ""),
      bandIds: (Array.isArray(out.bandIds) ? out.bandIds : []).filter((id) => known.has(id)),
      caveat: out.caveat ?? null,
    });
  } catch (err) {
    if (err.refusal) {
      return new Response("That question could not be answered.", { status: 422 });
    }
    const status = err.status ?? err.constructor?.name;
    if (status === 429 || status === "RateLimitError") {
      return new Response("Busy right now — try again in a moment.", { status: 429 });
    }
    if (status === 401 || status === 403 || status === "AuthenticationError" || status === "missing_sdk") {
      console.error("answer service misconfigured:", err.message);
      return new Response("The answer service is not configured.", { status: 500 });
    }
    console.error("ask failed:", err);
    return new Response("Could not answer that just now.", { status: 502 });
  }
};
