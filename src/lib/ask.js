/* ============================================================
   ask.js — the generation half of the ask feature.

   One implementation, deliberately: a deterministic local answerer
   reads the retrieved facts and says only what they support. There is
   no model call and no API key anywhere in this project, so running or
   deploying it cannot bill anyone.

   That is a product decision, not a missing feature. The abstention
   rules the tier table promises — a flagged band reported every time,
   "Limited info" never softened — are enforced here in code rather
   than asked of a model in a prompt, which is the stricter of the two.
   ============================================================ */

import { retrieve } from "./retrieve.js";

const inr = (n) => "₹" + n.toLocaleString("en-IN");

/* ---------- local fallback ----------
   Not a fake model. It states what was matched and what the seed
   data says, and it abstains in exactly the cases the tiers abstain:
   no usable match, or a claim the reviews cannot support. */

function localAnswer(query, r, date) {
  const i = r.intent;
  const bits = [];
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

  const lines = r.hits.map(({ band, a, free }) => {
    const price = inr(band.price.performance);
    const avail = date ? (free ? "free on your date" : "already booked that day") : "";
    const verdict =
      a.tier === "flagged" ? `flagged — ${a.headline}, and that is not cancelled out by the other reviews`
        : a.tier === "consistent" ? `${a.headline}`
        : a.tier === "mixed" ? `mixed — ${a.headline}`
        : `not enough evidence — ${a.headline}`;

    // Say the thing the question was actually about.
    const extra = [];
    if (i.destination) {
      extra.push(typeof band.price.outstation === "number"
        ? `travels for ${inr(band.price.outstation)}`
        : "no outstation rate listed");
      extra.push(band.price.contract ? "written contract" : "no written contract");
      extra.push(band.price.refundDays > 0
        ? `advance refundable up to ${band.price.refundDays} days before`
        : "advance non-refundable");
    }

    return `• ${band.name}, ${price} — ${verdict}${avail ? `, ${avail}` : ""}.` +
      (extra.length ? `\n   ${extra.join(" · ")}.` : "");
  });

  const flagged = r.hits.filter((h) => h.a.tier === "flagged");
  const thin = r.hits.filter((h) => h.a.tier === "limited");

  let caveat = null;
  if (flagged.length) {
    caveat = `${flagged.map((h) => h.band.name).join(" and ")} ${flagged.length > 1 ? "carry" : "carries"} a credible report of ` +
      `${[...new Set(flagged.flatMap((h) => h.a.flags.map((f) => f.flag)))].join(" and ")}. Shown deliberately — you are about to commit money you cannot get back.`;
  } else if (thin.length === r.hits.length) {
    caveat = `Every match here is below the ${r.hits[0].a.gate}-review evidence gate, so none of them has earned a trust claim either way.`;
  } else if (i.destination) {
    const noContract = r.hits.filter((h) => !h.band.price.contract);
    if (noContract.length) {
      caveat = `${noContract.map((h) => h.band.name).join(" and ")} ${noContract.length > 1 ? "have" : "has"} no written contract. ` +
        `For a band travelling to another city that is the term to push on before you pay an advance.`;
    }
  }

  // Say what would sharpen the answer, rather than leaving a vague
  // question answered vaguely with no way forward.
  const missing = [];
  if (!i.city) missing.push("a city");
  if (!i.budget && !i.wantsCheap) missing.push("a budget");
  if (!i.genres.length) missing.push("a style");
  const tail = missing.length
    ? `\n\nNarrow it with ${missing.slice(0, 2).join(" or ")} and this gets more useful.`
    : "";

  return {
    answer: `Reading that as: ${read}.\n\n${lines.join("\n")}${tail}`,
    bandIds: r.hits.map((h) => h.band.id),
    caveat,
  };
}

/* ---------- narrowing down ----------
   A question we cannot place is not a dead end. Rather than saying
   "nothing matches" and leaving the user to guess the magic words, ask
   for the one fact that would unlock it. Each answer is a real signal,
   so a single round is usually enough to reach results — and after two
   the answer is shown regardless, never a third question. */

const CLARIFY = [
  {
    key: "city",
    missing: (i) => !i.city,
    question: "Which city is the wedding in?",
    options: ["Delhi NCR", "Jaipur", "Mumbai", "Chandigarh", "Lucknow", "Anywhere"],
  },
  {
    key: "style",
    missing: (i) => !i.genres.length,
    question: "What should the band play?",
    options: ["Brass and dhol for the baraat", "Sufi and qawwali", "Bollywood and retro",
      "Bhangra and pop", "Jazz", "A live orchestra"],
  },
  {
    key: "budget",
    missing: (i) => !i.budget && !i.wantsCheap,
    question: "Roughly what are you willing to spend on the band?",
    options: ["Under ₹75,000", "Under ₹1.2 lakh", "Under ₹2 lakh", "No firm limit"],
  },
];

/* "Anywhere" and "No firm limit" deliberately carry no constraint —
   they answer the question without narrowing, and still count as asked. */
const NON_CONSTRAINING = new Set(["Anywhere", "No firm limit"]);

function nextClarify(intent, asked) {
  return CLARIFY.find((c) => !asked.includes(c.key) && c.missing(intent)) || null;
}

/* ---------- public API ---------- */

export async function ask(query, { date = null, facets = [], asked = [] } = {}) {
  // Answers to earlier questions are folded back into the query, so
  // retrieval reads one enriched sentence rather than a special case.
  const full = [query, ...facets.filter((f) => !NON_CONSTRAINING.has(f))].join(", ");
  const r = retrieve(full, { date });

  if (!r.grounded) {
    const c = nextClarify(r.intent, asked);
    if (c && asked.length < 2) {
      return { clarify: c, live: false, hits: [], intent: r.intent, query, facets, asked };
    }
    // Out of questions: show the best-evidenced bands rather than
    // sending the user away with nothing.
    const best = retrieve("a good reliable band", { date });
    return {
      ...localAnswer(query, best, date),
      answer:
        "I could not tell what you were after from that, so here are the ones the reviews actually back — " +
        "the tiers are unchanged, and a flagged band is still shown as flagged.\n\n" +
        localAnswer(query, best, date).answer.split("\n\n").slice(1).join("\n\n"),
      live: false, hits: best.hits, intent: best.intent, exhausted: true,
    };
  }

  await new Promise((res) => setTimeout(res, 260));
  return { ...localAnswer(query, r, date), live: false, hits: r.hits, intent: r.intent };
}
