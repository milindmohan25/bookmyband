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

The search page opens with a plain-language box: *"brass band for a baraat in Delhi under ₹1 lakh"*, or the question the product is really about — *"which of these has actually turned up on the day?"* It's a real chat now, not a one-shot lookup: a question the catalogue can't place gets a follow-up as the next reply instead of a dead end, and the conversation carries forward.

**Retrieval** (`src/lib/retrieve.js`) runs server-side, over whatever the catalogue server function returns — Supabase when configured, the same hand-tagged seed set otherwise. No vector store and no embedding call: eight bands with hand-tagged reviews is a scoring problem, not a search-infrastructure problem. It reads city, style, budget (including "1 lakh" and "80k"), size and reliability intent, then emits a compact fact sheet per band — prices, terms, tier, and the reviews that carry reliability evidence.

**Generation** (`src/lib/concierge.server.ts`) is a single structured call over those fact sheets only, so the model cannot invent a band, a price or a review. Either provider works, picked by whichever key is set — `GROQ_API_KEY` (Groq's OpenAI-compatible `chat/completions`) or `ANTHROPIC_API_KEY` (Claude). The abstention rules from the tier table are enforced in the system prompt and again in code: a flagged band is reported every time it is mentioned, "Limited Info" is never softened into "seems fine", and band ids the model returns are filtered against what was actually retrieved. A question that matches nothing is answered without calling the model at all — and if a follow-up goes unresolved twice, the concierge shows the best-evidenced bands rather than asking a third time.

**The key never reaches the browser.** `concierge.server.ts` and `catalog.server.ts` are server-only modules (TanStack Start's `createServerFn` compiles them out of the client bundle entirely) — the browser calls `askConcierge`/`getBands` as RPCs and never sees a key. With no model key configured, the same retrieved facts are read out by a deterministic local composer, and the UI says so on screen rather than passing it off as a model.

## Booking

There's no account system. A booking request is a guest submission — name, phone, occasion and venue city travel in the booking row itself (`booking-schema.ts`, validated by Zod both client-side for instant feedback and server-side as the authoritative check), so nobody has to sign in before a band can be asked to hold a date. The booking table has no public read policy: only the secret key, from a trusted context, can read a submitted booking back.

*(An earlier version of this app gated enquiries behind Google OAuth / a passwordless email link, storing them in `profiles`/`enquiries` tables — see git history if that flow is wanted back. It was replaced when the app moved to a real catalogue + booking backend, since the new booking schema is guest-first by design.)*

## Stack

- Frontend: React 19, server-rendered via TanStack Start (file-based routes, `createServerFn` for all server work)
- Data: Zod for schema validation, shared between client-side instant feedback and server-side authoritative checks
- Catalogue/bookings: Supabase (Postgres, RLS, new-style `sb_publishable_`/`sb_secret_` keys) — falls back to the same hand-authored seed set with no project configured, so the demo never goes dark for missing infrastructure
- AI: Groq or the Anthropic API, one structured call per question, retrieval-grounded — see above
- Hosting: Netlify, via `@netlify/vite-plugin-tanstack-start` (builds the server functions into Netlify Functions automatically)

## Running locally

```
npm install
npm run dev       # dev server on :3000
npm run build     # production build to dist/
npm run preview   # preview the production build
```

No Supabase project is required to run the app — the catalogue and booking server functions fall back to the seed set and a console-logged mock respectively. To use a real project, run `supabase/schema.sql` then `supabase/seed.sql` against it, and copy `.env.example` to `.env.local` with the project's URL and publishable key.

## Repo layout

```
.env.example
supabase/
  schema.sql        # bands + bookings tables, RLS policies
  seed.sql          # the 8 hand-authored bands, generated from src/lib/seed.js
src/
  router.tsx, routes/            # TanStack Start routing + root document
  App.jsx           # screens: welcome, search + ask, results, band detail, booking
  lib/
    seed.js                   # the bands, their reviews, and the tier assessment
    retrieve.js                # retrieval + fact sheets (the R in RAG)
    catalog.server.ts / .functions.ts   # public band reads (Supabase or seed fallback)
    booking-schema.ts / .server.ts / .functions.ts   # guest booking submissions
    chat.functions.ts / concierge.server.ts          # the Ask feature's server side
  components/
    BootLogo.jsx    # animated splash screen, played once as the boot screen
    Welcome.jsx     # the screen between the boot animation and search
```

## Notes

Full PRD lives in Notion.
