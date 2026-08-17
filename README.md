[Uploading README.md…]()
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
- [ ] Seed data — sparse-review bands, a dispute-flagged band, strong-review bands
- [ ] Reliability Signal prompt + abstention constraints
- [ ] Working demo
- [ ] Deployed

## Stack

- Frontend: React
- AI: Anthropic API (Claude), single structured call per band
- Data: local JSON seed set (no DB — 20-30 bands doesn't need one)
- Hosting: static deploy

## Repo layout

```
src/
  components/
    BootLogo.jsx    # animated splash screen
```

## Notes

Full PRD lives in Notion.
