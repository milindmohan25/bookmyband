/* ============================================================
   ask — the only place the Anthropic key exists.

   A static site cannot keep a secret, so the model call lives here.
   Retrieval is re-run server-side from the same seed module the app
   uses: the browser sends a question, never context, so a crafted
   request cannot feed the model facts that are not in the seed set.

   Deploy: Netlify function. Set ANTHROPIC_API_KEY in the site's
   environment, and point the app at it with
   VITE_ASK_ENDPOINT=/.netlify/functions/ask
   ============================================================ */

import Anthropic from "@anthropic-ai/sdk";
import { retrieve } from "../../src/lib/retrieve.js";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

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

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Question: ${query}\n` +
            (date ? `Their date: ${date}\n` : "") +
            `\nBand records:\n\n${r.context}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return new Response("That question could not be answered.", { status: 422 });
    }

    const text = response.content.find((b) => b.type === "text")?.text || "";
    const out = JSON.parse(text);

    // Never let a hallucinated id through to the UI as a band card.
    const known = new Set(r.hits.map((h) => h.band.id));
    return Response.json({
      answer: out.answer,
      bandIds: (out.bandIds || []).filter((id) => known.has(id)),
      caveat: out.caveat ?? null,
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return new Response("Busy right now — try again in a moment.", { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("ANTHROPIC_API_KEY missing or invalid");
      return new Response("The answer service is not configured.", { status: 500 });
    }
    console.error("ask failed:", err);
    return new Response("Could not answer that just now.", { status: 502 });
  }
};
