/* ============================================================
   ask.js — the generation half of the ask feature.

   Two implementations behind one call, the same shape as backend.js:
   if VITE_ASK_ENDPOINT is set, the question goes to a small server
   function that holds the Anthropic key and runs the retrieval and
   the model call; if it is not, a deterministic local answerer reads
   the same retrieved facts and says only what they support.

   The key is never in this file and never in the bundle. A static
   site cannot hold a secret, so the live path is a fetch to a
   function, not an API call from the browser.
   ============================================================ */

import { retrieve } from "./retrieve.js";
import { SEED } from "./seed.js";

const ENDPOINT = (typeof import.meta !== "undefined" && import.meta.env?.VITE_ASK_ENDPOINT) || "";

export const ASK_IS_LIVE = Boolean(ENDPOINT);

const inr = (n) => "₹" + n.toLocaleString("en-IN");

/* ---------- local fallback ----------
   Not a fake model. It states what was matched and what the seed
   data says, and it abstains in exactly the cases the tiers abstain:
   no usable match, or a claim the reviews cannot support. */

function localAnswer(query, r, date) {
  if (!r.grounded) {
    return {
      answer:
        `Nothing in the seed set matches that. There are ${SEED.length} bands here, across Delhi NCR, ` +
        `Jaipur, Mumbai, Chandigarh and Lucknow — try naming a city, a style (brass, sufi, jazz, bhangra, ` +
        `orchestra), a budget, or ask which ones have actually been reliable.`,
      bandIds: [],
      caveat: null,
    };
  }

  const bits = [];
  if (r.intent.city) bits.push(`in ${r.intent.city}`);
  if (r.intent.genres.length) bits.push(r.intent.genres.join(" and "));
  if (r.intent.budget) bits.push(`under ${inr(r.intent.budget)}`);
  if (r.intent.wantsReliable) bits.push("with reliability evidence");
  const read = bits.length ? bits.join(", ") : "your wording";

  const lines = r.hits.map(({ band, a, free }) => {
    const price = inr(band.price.performance);
    const avail = date ? (free ? "free on your date" : "already booked that day") : "";
    const verdict =
      a.tier === "flagged" ? `flagged — ${a.headline}, and that is not cancelled out by the other reviews`
        : a.tier === "consistent" ? `${a.headline}`
        : a.tier === "mixed" ? `mixed — ${a.headline}`
        : `not enough evidence — ${a.headline}`;
    return `• ${band.name}, ${price} — ${verdict}${avail ? `, ${avail}` : ""}.`;
  });

  const flagged = r.hits.filter((h) => h.a.tier === "flagged");
  const thin = r.hits.filter((h) => h.a.tier === "limited");

  let caveat = null;
  if (flagged.length) {
    caveat = `${flagged.map((h) => h.band.name).join(" and ")} ${flagged.length > 1 ? "carry" : "carries"} a credible report of ` +
      `${[...new Set(flagged.flatMap((h) => h.a.flags.map((f) => f.flag)))].join(" and ")}. Shown deliberately — you are about to commit money you cannot get back.`;
  } else if (thin.length === r.hits.length) {
    caveat = `Every match here is below the ${r.hits[0].a.gate}-review evidence gate, so none of them has earned a trust claim either way.`;
  }

  return {
    answer: `Reading that as: ${read}.\n\n${lines.join("\n")}`,
    bandIds: r.hits.map((h) => h.band.id),
    caveat,
  };
}

/* ---------- public API ---------- */

export async function ask(query, { date = null, signal } = {}) {
  const r = retrieve(query, { date });

  if (!ASK_IS_LIVE) {
    await new Promise((res) => setTimeout(res, 260));
    return { ...localAnswer(query, r, date), live: false, hits: r.hits, intent: r.intent };
  }

  // The server re-runs retrieval from its own copy of the seed data,
  // so a hand-crafted request cannot feed the model invented context.
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, date }),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail?.slice(0, 200) || `The answer service returned ${res.status}.`);
  }
  const data = await res.json();
  return {
    answer: data.answer || "",
    bandIds: Array.isArray(data.bandIds) ? data.bandIds : [],
    caveat: data.caveat || null,
    live: true,
    hits: r.hits,
    intent: r.intent,
  };
}
