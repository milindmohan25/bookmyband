/* ============================================================
   retrieve.js — the retrieval half of the ask feature.

   Runs entirely in the browser over SEED. There is no vector store
   and no embedding call: 8 bands with hand-tagged reviews is a
   scoring problem, not a search-infrastructure problem, and keeping
   it local means retrieval cannot leak, cost anything, or fail.

   What leaves this file is a compact fact sheet per band. The model
   only ever sees these sheets, so it cannot invent a band, a price
   or a review that is not in the seed set.
   ============================================================ */

import { SEED, assess } from "./seed.js";

const STOP = new Set([
  "a", "an", "the", "and", "or", "for", "with", "who", "that", "this", "our", "we",
  "i", "is", "are", "was", "be", "to", "of", "in", "on", "at", "it", "my", "me",
  "can", "you", "want", "need", "looking", "look", "find", "get", "some", "any",
  "band", "bands", "wedding", "please", "would", "like", "there", "their",
]);

const words = (s) => (s || "").toLowerCase().match(/[a-z0-9₹]+/g) || [];
const terms = (s) => words(s).filter((w) => w.length > 2 && !STOP.has(w));

/* ---------- intent extraction ----------
   Small, explicit and auditable. Each signal states what it read from
   the query, so the UI can show the user how their words were
   interpreted rather than silently guessing. */

const CITY_WORDS = {
  "delhi ncr": ["delhi", "ncr", "gurgaon", "noida", "gurugram"],
  Jaipur: ["jaipur", "rajasthan"],
  Mumbai: ["mumbai", "bombay"],
  Chandigarh: ["chandigarh", "punjab", "mohali"],
  Lucknow: ["lucknow", "awadh"],
};

/* Indian money talk: "1.5 lakh", "80k", "₹90,000", "under 1,00,000".
   A bare number only counts as a budget when the sentence is about
   money — otherwise any stray digits would silently become a price cap. */
function readBudget(q) {
  const s = q.toLowerCase().replace(/,/g, "");
  let m = s.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|l\b)/);
  if (m) return Math.round(parseFloat(m[1]) * 100000);
  m = s.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (m) return Math.round(parseFloat(m[1]) * 1000);
  m = s.match(/₹\s*(\d{4,7})/) || s.match(/\brs\.?\s*(\d{4,7})/);
  if (m) return parseInt(m[1], 10);
  if (/under|below|less|within|max|budget|upto|up to|around|about|spend|cost|price|per/.test(s)) {
    m = s.match(/\b(\d{4,7})\b/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

const GENRE = {
  sufi: ["sufi", "ghazal", "qawwali", "soulful", "spiritual"],
  brass: ["brass", "baraat", "barat", "dhol", "procession", "processional", "entry"],
  bollywood: ["bollywood", "hindi", "filmi", "film", "retro", "punjabi"],
  bhangra: ["bhangra", "pop", "dance", "party", "energetic", "upbeat"],
  jazz: ["jazz", "classy", "elegant", "sophisticated", "cocktail"],
  orchestra: ["orchestra", "strings", "grand", "large", "symphony"],
};

export function readIntent(query) {
  const w = new Set(words(query));
  const has = (list) => list.some((t) => w.has(t));

  const city = Object.keys(CITY_WORDS).find((c) => has(CITY_WORDS[c])) || null;
  const genres = Object.keys(GENRE).filter((g) => has(GENRE[g]));
  const budget = readBudget(query);

  // The reliability thesis of the product, asked in plain words. Written
  // against how people actually phrase it — "did they turn up", "turned
  // up on the day", "will they show" — rather than one canonical form.
  const wantsReliable =
    /reliab|depend|trust|dodgy|legit|actually turn|turn(s|ed|ing)? up|show(s|ed|ing)? up|showed|no.?show|cancel|dispute|refund|deposit|contract|late|risk|safe|worry|worried|problem|go wrong|went wrong|let (us|me|you) down/i
      .test(query);

  const intent = {
    city,
    genres,
    budget,
    wantsReliable,
    wantsCheap: /cheap|budget|afford|inexpensive|low.?cost|save|value/i.test(query),
    wantsBig: /\bbig\b|large|grand|huge|\b1[0-9]\s*piece|orchestra/i.test(query),
    wantsSmall: /small|intimate|quiet|acoustic|\bfew\b/i.test(query),
    // A destination wedding is a travel question, and the seed set can
    // answer it: outstation cost, whether there is a written contract,
    // and whether the advance comes back if plans move.
    destination: /destination|outstation|out.?station|out of town|another city|travel|travell|away|abroad|goa|udaipur|resort|palace/i.test(query),
    // "a good band", "best one", "worth it" — vague, but a real question.
    // Answered with what the evidence supports, not refused for wording.
    wantsGood: /\bgood\b|\bbest\b|\bnice\b|great|recommend|suggest|\btop\b|decent|quality|worth|favourite|favorite|should i|which one/i.test(query),
  };

  // What we understood. A recognised intent counts even when the question
  // names no band or genre — "did they actually turn up?" and "a good
  // destination band" both matter and match no band's text.
  intent.hasSignal = Boolean(
    city || genres.length || budget || wantsReliable ||
    intent.wantsCheap || intent.wantsBig || intent.wantsSmall ||
    intent.destination || intent.wantsGood
  );

  return intent;
}

/* ---------- scoring ---------- */

function scoreBand(band, query, intent, date) {
  const a = assess(band);
  const hay = `${band.name} ${band.city} ${band.kind}`.toLowerCase();
  let score = 0;
  const why = [];

  for (const t of terms(query)) {
    if (hay.includes(t)) { score += 3; why.push(`matches "${t}"`); }
  }

  if (intent.city && band.city === intent.city) { score += 5; why.push(`in ${band.city}`); }
  else if (intent.city) score -= 4;

  for (const g of intent.genres) {
    if (GENRE[g].some((t) => hay.includes(t))) { score += 4; why.push(`plays ${g}`); }
  }

  if (intent.budget) {
    if (band.price.performance <= intent.budget) { score += 4; why.push(`within ₹${intent.budget.toLocaleString("en-IN")}`); }
    else score -= 5;
  }
  if (intent.wantsCheap) score += Math.max(0, 3 - band.price.performance / 60000);
  if (intent.wantsBig) score += band.size >= 12 ? 3 : -1;
  if (intent.wantsSmall) score += band.size <= 8 ? 3 : -1;

  // Reliability is never used to bury a flag — a flagged band still
  // surfaces so the answer can warn about it. Asking for a reliable
  // band promotes the evidenced ones and ranks the rest below, rather
  // than dropping them and leaving the warning unsaid.
  if (intent.wantsReliable) {
    const byTier = { consistent: 6, flagged: 4, mixed: 2, limited: 1 };
    score += byTier[a.tier] ?? 0;
    why.push(
      a.tier === "consistent" ? "reliability is evidenced"
        : a.tier === "flagged" ? "flagged — surfaced as a warning"
        : a.tier === "mixed" ? "reviewers disagree on reliability"
        : "too little evidence to say"
    );
  }

  // Travelling changes what matters: a written contract and a refundable
  // advance stop being paperwork once the band has to reach another city.
  if (intent.destination) {
    score += 2;
    if (band.price.contract) { score += 3; why.push("has a written contract"); }
    else { score -= 2; why.push("no written contract — risky for travel"); }
    if (band.price.refundDays > 0) { score += 2; why.push(`advance refundable up to ${band.price.refundDays} days before`); }
    if (typeof band.price.outstation === "number") {
      score += Math.max(0, 3 - band.price.outstation / 12000);
      why.push(`travels outstation for ₹${band.price.outstation.toLocaleString("en-IN")}`);
    }
  }

  // A vague ask is still a real one. Answer it with what the evidence
  // supports rather than refusing it for its wording — the tiers already
  // stop this from becoming a fabricated recommendation.
  if (intent.wantsGood) {
    const byTier = { consistent: 5, mixed: 2, limited: 1, flagged: 3 };
    score += byTier[a.tier] ?? 0;
    if (a.tier === "consistent") why.push("the evidence backs it");
    if (a.tier === "flagged") why.push("flagged — surfaced so it is not mistaken for a safe pick");
  }

  const free = !date || !band.booked.includes(date);
  if (date && !free) score -= 3;

  return { band, a, score, free, why: [...new Set(why)] };
}

/* ---------- fact sheets ----------
   Deliberately terse and fully factual. Reviews are included only
   where they carry reliability evidence, with their tag, so the model
   can quote a real reviewer instead of paraphrasing a vibe. */

const money = (v) =>
  v === null || v === undefined ? "not offered"
    : v === "included" ? "included"
    : v === 0 ? "no charge"
    : `₹${v.toLocaleString("en-IN")}`;

export function factSheet({ band, a, free }, date) {
  const evidence = [...a.flags, ...a.negative.filter((r) => !r.flag), ...a.specific].slice(0, 5);
  return [
    `id: ${band.id}`,
    `name: ${band.name}`,
    `city: ${band.city}`,
    `type: ${band.kind} (${band.size} musicians)`,
    `performance (3 hrs): ${money(band.price.performance)}`,
    `extra hour: ${money(band.price.extraHour)} | sound: ${money(band.price.sound)} | travel in city: ${money(band.price.travelCity)}`,
    `outstation: ${money(band.price.outstation)} | early setup: ${money(band.price.earlySetup)} | dj: ${money(band.price.dj)}`,
    `advance: ${band.price.advancePct}% | refundable: ${band.price.refundDays === 0 ? "no" : band.price.refundDays + " days before"} | written contract: ${band.price.contract ? "yes" : "no"}`,
    `reliability tier: ${a.label} (${a.headline})`,
    `reviews: ${a.total} total, ${a.onTopic} of them mention reliability (gate for any trust claim is ${a.gate})`,
    date ? `on ${date}: ${free ? "available" : "already booked"}` : null,
    evidence.length
      ? "reliability evidence:\n" + evidence.map((r) =>
          `  - [${r.flag ? r.flag.toUpperCase() : r.reliability === "negative" ? "problem" : "went to plan"}] "${r.text}" — ${r.author}, ${r.date}`
        ).join("\n")
      : "reliability evidence: none — no review says anything about turning up or playing what was booked",
  ].filter(Boolean).join("\n");
}

/* Top-k bands for a query, with the context block the model sees. */
export function retrieve(query, { date = null, k = 4 } = {}) {
  const intent = readIntent(query);
  const ranked = SEED
    .map((b) => scoreBand(b, query, intent, date))
    .sort((x, y) => y.score - x.score);

  // A query we understood nothing of retrieves nothing, rather than
  // returning an arbitrary four bands and letting the answer dress
  // them up as a recommendation. A recognised intent counts as
  // understanding even when the question names no band or genre —
  // "did they actually turn up?" is the question this product exists
  // for and matches no band's text.
  const meaningful = ranked.filter((r) => r.score > 0);
  const grounded = meaningful.length > 0 || intent.hasSignal;
  const hits = (meaningful.length ? meaningful : ranked).slice(0, k);

  return {
    intent,
    hits,
    grounded,
    context: hits.map((h) => factSheet(h, date)).join("\n\n---\n\n"),
  };
}
