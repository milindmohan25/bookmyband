# BookMyBand

A portfolio project exploring an AI feature where AI is genuinely load-bearing — and designing around its failure mode rather than hiding it.

## The problem

Booking a live band for a wedding is a high-value, non-refundable, single-shot purchase made by people who will do it exactly once. The friction isn't taste-matching ("I want something upbeat but classy"). It's **opacity and risk**:

- Quoted prices are non-standardised and non-comparable across vendors — what's included differs, so line items can't be compared
- Availability for a specific date is unconfirmed until after an inquiry, wasting cycles
- Reliability is unknowable in advance — no-shows, substituted musicians, and deposit disputes are documented outcomes

> Evidence base: consumer commission rulings, wedding vendor review platforms, and first-hand accounts on forums. See PRD for citations.

## MVP scope

Three things, all aimed at trust/opacity:

1. **Reliability Signal** *(the AI feature)* — synthesises unstructured reviews into a tiered trust indicator
2. **Standardised price breakdown** — same line items across every band, normalised from messy vendor listings
3. **Date availability confirmation** — before the inquiry, not after

Explicitly out of scope: band-side dashboard, payments, vibe/style matching, messaging.

## The design decision worth talking about

The Reliability Signal never fakes confidence it doesn't have.

A band with 2 reviews returns **"Limited Info"** — not a polished score that renders identically to a band with 50 reviews. A confident "no complaints found" on thin data would be a real defect, not a nitpick, because a user is about to commit non-refundable money on the strength of it.

Evidence volume gates which tier is even reachable. A band cannot earn a positive signal it doesn't have the data to support.

| Tier | Gate | What the user sees |
|---|---|---|
| **Limited Info** | Fewer than 5 usable reviews, regardless of sentiment | No trust claim. States the evidence is insufficient and why. |
| **Mixed / Unclear** | 5+ reviews, but conflicting or non-specific on reliability | Surfaces the disagreement rather than averaging it away |
| **Consistent** | 5+ reviews with specific, corroborating reliability mentions (showed up, on time, as booked) | Positive signal, with the specific behaviours cited |
| **Flagged** | Any credible report of no-show, substitution, or deposit dispute | Warning, shown regardless of how many positive reviews exist |

**Flagged is not averaged out.** One credible dispute report survives fifty five-star reviews, because the downside is asymmetric.

## Status

- [x] PRD v2.0 (problem, JTBDs, scope, AI feature design)
- [x] Seed data — sparse-review bands, a dispute-flagged band, strong-review bands
- [x] Reliability Signal — deterministic tiers over hand-tagged reviews
- [x] Ask — plain-language questions answered by Claude over the seed set (RAG), with the same abstention rules
- [x] Working demo
- [ ] Deployed

## Ask — the RAG feature

The search page opens with a plain-language box: *"brass band for a baraat in Delhi under ₹1 lakh"*, or the question the product is really about — *"which of these has actually turned up on the day?"*

**Retrieval** runs in the browser over the seed set (`src/lib/retrieve.js`). No vector store and no embedding call: eight bands with hand-tagged reviews is a scoring problem, not a search-infrastructure problem, and keeping it local means retrieval cannot leak, cost anything, or fail. It reads city, style, budget (including "1 lakh" and "80k"), size and reliability intent, then emits a compact fact sheet per band — prices, terms, tier, and the reviews that carry reliability evidence.

**Generation** is a single structured Claude call (`claude-opus-5`) over those fact sheets only, so the model cannot invent a band, a price or a review. The abstention rules from the tier table are enforced in the system prompt and again in code: a flagged band is reported every time it is mentioned, "Limited Info" is never softened into "seems fine", and band ids the model returns are filtered against what was actually retrieved. A question that matches nothing is answered without calling the model at all.

**The key never reaches the browser.** A static site cannot hold a secret, so the call lives in `netlify/functions/ask.js` and the client sends only a question — never context, so a crafted request cannot feed the model invented facts. With no endpoint configured the same retrieved facts are read out by a deterministic local answerer, and the UI says so on screen rather than passing it off as a model.

## Stack

- Frontend: React (Vite)
- AI: Anthropic API (Claude Opus 5), one structured call per question, retrieval-grounded — see above
- Auth/data: Supabase (Google OAuth + passwordless email, Postgres with row-level security) for profiles and enquiries; falls back to an in-memory store with no keys set — see [AUTH.md](./AUTH.md)
- Bands, prices and reviews: local JSON seed set (authored content, not user writes — no DB needed for these)
- Hosting: static deploy

## Running locally

```
npm install
npm run dev       # dev server
npm run build     # production build to dist/
npm run preview   # preview the production build
```

No Supabase keys are required to run the app — sign-in and enquiries work against an in-memory mock automatically. To use a real Supabase project instead, copy `.env.example` to `.env.local` and follow [AUTH.md](./AUTH.md).

## Repo layout

```
index.html
.env.example
AUTH.md             # Supabase setup, and why phone OTP was rejected
supabase/
  schema.sql        # profiles + enquiries tables, RLS policies
netlify/functions/
  ask.js            # the only place the Anthropic key exists
src/
  main.jsx          # entry point
  App.jsx           # screens: search + ask, results, band detail, account
  lib/
    seed.js         # the bands, their reviews, and the tier assessment
    retrieve.js     # local retrieval + fact sheets (the R in RAG)
    ask.js          # calls the endpoint, or answers locally with no keys set
    backend.js      # Supabase client over plain fetch, with an in-memory fallback
  components/
    BootLogo.jsx    # animated splash screen, played once as the boot screen
```

## Notes

Full PRD lives in Notion.
