import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  IS_LIVE, getSession, consumeRedirect, signInWithGoogle, sendEmailLink, signOut,
  getProfile, saveProfile, listEnquiries, createEnquiry,
} from "./lib/backend";
import { Piece, CUES, AUTHORED_TOTAL, FIELDS } from "./components/BootLogo.jsx";

/* ============================================================
   BookMyBand — working demo, no model in the loop.
   Reliability tiers are computed by pure functions from
   hand-tagged review metadata in SEED. Same UI contract as the
   AI version: evidence volume gates which tier is reachable.
   ============================================================ */

/* ---------- tokens ---------- */

const C = {
  ink: "#3A0A0C",        // body text — maroon-black, not grey
  inkSoft: "#7A5D50",
  paper: "#F8EEDB",      // marigold-tinted ivory
  paperDeep: "#EFE0C6",
  rule: "#DCC79F",
  field: "#A61217",      // brand red (from BootLogo)
  fieldDeep: "#48060A",
  gold: "#C08A24",
  goldLite: "#F3C862",
  cream: "#FFF2D4",
  green: "#1F5F4A",      // Consistent — peacock green
  marigold: "#B7700A",   // Mixed
  crimson: "#9E1B1B",    // Flagged
  mute: "#8B7A66",       // Limited info
};

const FONT_DISPLAY = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
const FONT_BODY = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_DATA = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const CSS = `
.bmb * { box-sizing: border-box; }
.bmb {
  font-family: ${FONT_BODY};
  color: ${C.ink};
  background: ${C.paper};
  min-height: 100%;
  -webkit-font-smoothing: antialiased;
}
.bmb-wrap { max-width: 660px; margin: 0 auto; padding: 0 20px 64px; }

.bmb-topbar {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 18px 0 14px; border-bottom: 1px solid ${C.rule};
  position: sticky; top: 0; background: ${C.paper}; z-index: 5;
}
.bmb-logo { font-family: ${FONT_DISPLAY}; font-size: 20px; letter-spacing: 0.01em; }
.bmb-logo em { color: ${C.gold}; font-style: normal; }

.bmb-eyebrow {
  font-family: ${FONT_DATA}; font-size: 11px; letter-spacing: 0.16em;
  text-transform: uppercase; color: ${C.inkSoft};
}
.bmb-h1 { font-family: ${FONT_DISPLAY}; font-size: 30px; line-height: 1.15; margin: 10px 0 6px; font-weight: 400; }
.bmb-h2 { font-family: ${FONT_DISPLAY}; font-size: 21px; line-height: 1.2; margin: 0; font-weight: 400; }
.bmb-lede { font-size: 15px; line-height: 1.55; color: ${C.inkSoft}; margin: 0 0 24px; }

.bmb-label { display: block; font-family: ${FONT_DATA}; font-size: 11px; letter-spacing: 0.14em;
  text-transform: uppercase; color: ${C.inkSoft}; margin-bottom: 7px; }
.bmb-input, .bmb-select {
  width: 100%; padding: 12px 13px; font-size: 15px; font-family: ${FONT_DATA};
  color: ${C.ink}; background: #FFFBF2; border: 1px solid ${C.rule}; border-radius: 2px;
  appearance: none;
}
.bmb-input:focus-visible, .bmb-select:focus-visible, .bmb-btn:focus-visible, .bmb-card:focus-visible,
.bmb-link:focus-visible, .bmb-tab:focus-visible {
  outline: 2px solid ${C.field}; outline-offset: 2px;
}
.bmb-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 14px 18px; border: none; border-radius: 2px; cursor: pointer;
  background: ${C.field}; color: ${C.cream}; font-family: ${FONT_BODY};
  font-size: 15px; font-weight: 600; letter-spacing: 0.01em;
}
.bmb-btn:hover { background: #8E1013; }
.bmb-btn--ghost { background: transparent; color: ${C.ink}; border: 1px solid ${C.rule}; font-weight: 500; }
.bmb-btn--ghost:hover { background: ${C.paperDeep}; }
.bmb-link {
  background: none; border: none; padding: 0; cursor: pointer; font-family: ${FONT_BODY};
  font-size: 14px; color: ${C.field}; text-decoration: underline; text-underline-offset: 3px;
}

.bmb-card {
  display: block; width: 100%; text-align: left; cursor: pointer;
  background: #FFFBF2; border: 1px solid ${C.rule}; border-radius: 2px;
  padding: 16px 16px 14px; margin-bottom: 12px; font-family: inherit; color: inherit;
}
.bmb-card:hover { border-color: ${C.gold}; }
.bmb-card--flagged { border-left: 4px solid ${C.crimson}; }

.bmb-meta { font-family: ${FONT_DATA}; font-size: 12px; color: ${C.inkSoft}; letter-spacing: 0.02em; }

/* evidence meter — the signature. slots are the gate, gaps are honest. */
.bmb-meter { display: flex; gap: 3px; align-items: center; }
.bmb-slot { width: 15px; height: 7px; border: 1px solid currentColor; border-radius: 1px; }
.bmb-slot--full { background: currentColor; }
.bmb-slot--over { width: 7px; }

.bmb-tier { font-family: ${FONT_DATA}; font-size: 11.5px; letter-spacing: 0.13em; text-transform: uppercase; font-weight: 700; }

.bmb-panel { border: 1px solid ${C.rule}; border-radius: 2px; background: #FFFBF2; padding: 18px 16px; margin-bottom: 16px; }
.bmb-panel--flag { border: 1px solid ${C.crimson}; background: #FDF3EE; }

.bmb-ledger { width: 100%; border-collapse: collapse; font-family: ${FONT_DATA}; font-size: 13px; }
.bmb-ledger td { padding: 9px 0; border-bottom: 1px dotted ${C.rule}; vertical-align: baseline; }
.bmb-ledger td:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.bmb-ledger tr.is-absent td { color: ${C.mute}; }
.bmb-ledger tr.is-absent td:last-child { text-decoration: line-through; text-decoration-color: ${C.mute}; }
.bmb-ledger tr.is-total td { border-bottom: 2px solid ${C.ink}; border-top: 1px solid ${C.ink}; font-weight: 700; padding-top: 12px; }

.bmb-quote { border-left: 2px solid ${C.rule}; padding: 2px 0 2px 12px; margin: 10px 0; font-size: 14px; line-height: 1.55; }
.bmb-tag { font-family: ${FONT_DATA}; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; }

.bmb-tabs { display: flex; gap: 0; border-bottom: 1px solid ${C.rule}; margin-bottom: 18px; }
.bmb-tab {
  background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer;
  padding: 10px 14px 9px; font-family: ${FONT_DATA}; font-size: 11.5px; letter-spacing: 0.12em;
  text-transform: uppercase; color: ${C.inkSoft};
}
.bmb-tab[aria-selected="true"] { color: ${C.ink}; border-bottom-color: ${C.field}; font-weight: 700; }

.bmb-note { font-size: 13px; line-height: 1.55; color: ${C.inkSoft}; }

.bmb-scrim {
  position: fixed; inset: 0; z-index: 20; background: rgba(45, 5, 7, 0.55);
  display: flex; align-items: flex-end; justify-content: center;
}
@media (min-width: 560px) { .bmb-scrim { align-items: center; } }
.bmb-sheet {
  width: 100%; max-width: 420px; background: ${C.paper}; border-top: 3px solid ${C.gold};
  padding: 22px 20px 26px; border-radius: 4px 4px 0 0;
  animation: bmbSheet 260ms cubic-bezier(.2,.8,.3,1) both;
}
@media (min-width: 560px) { .bmb-sheet { border-radius: 4px; margin: 20px; } }
@keyframes bmbSheet { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .bmb-sheet { animation: none; } }

.bmb-phone { display: flex; align-items: stretch; }
.bmb-phone span {
  display: flex; align-items: center; padding: 0 11px; font-family: ${FONT_DATA}; font-size: 15px;
  background: ${C.paperDeep}; border: 1px solid ${C.rule}; border-right: none; color: ${C.inkSoft};
}
.bmb-otp { letter-spacing: 0.5em; font-size: 20px; text-align: center; }
.bmb-error { font-size: 13px; color: ${C.crimson}; margin: 9px 0 0; line-height: 1.5; }
.bmb-demo {
  font-family: ${FONT_DATA}; font-size: 11.5px; line-height: 1.5; color: ${C.inkSoft};
  border: 1px dashed ${C.rule}; padding: 9px 11px; margin-top: 14px;
}
.bmb-avatar {
  width: 30px; height: 30px; border-radius: 50%; border: 1px solid ${C.gold}; background: ${C.paperDeep};
  font-family: ${FONT_DISPLAY}; font-size: 14px; color: ${C.ink}; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.bmb-rise { animation: bmbRise 340ms cubic-bezier(.2,.8,.3,1) both; }
@keyframes bmbRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .bmb-rise { animation: none; } }
`;

/* ---------- seed data ----------
   `reliability`: what a review actually evidences about showing up.
     specific  — names a concrete reliability behaviour (arrived on time, played the booked set)
     negative  — reports a reliability failure short of a dispute (late, short set)
     none      — praise or complaint with no reliability content (vibe, song list, price)
   `flag`: credible report of no-show / substitution / deposit dispute. Never averaged away.
*/

const R = (author, date, text, reliability, flag) => ({ author, date, text, reliability, flag: flag || null });

const SEED = [
  {
    id: "sitara",
    name: "Sitara Sound Collective",
    city: "Delhi NCR",
    kind: "10-piece live band · Hindi, Punjabi, retro",
    size: 10,
    booked: ["2026-11-21", "2026-12-05", "2026-12-12"],
    price: {
      performance: 145000, extraHour: 22000, sound: "included", travelCity: 0,
      outstation: 18000, earlySetup: 8000, dj: 25000,
      advancePct: 40, refundDays: 45, contract: true,
    },
    reviews: [
      R("Ritika S.", "Feb 2026", "Arrived at 4pm for a 7pm start, sound check done well before guests came in. Played the full three hours we booked.", "specific"),
      R("Aman & Nidhi", "Jan 2026", "Same ten musicians we met at the audition turned up on the day. That mattered more to us than anything.", "specific"),
      R("Harpreet K.", "Dec 2025", "Set list was a bit safe for our crowd, we wanted more Punjabi folk. But they were exactly on schedule.", "specific"),
      R("Devansh M.", "Dec 2025", "Great energy, the brass section was the highlight of the sangeet.", "none"),
      R("Sunita R.", "Nov 2025", "Stayed 20 minutes past the end because the pheras ran late. No fuss, no extra charge.", "specific"),
      R("Kabir J.", "Nov 2025", "Sound engineer knew the venue already so setup was quick.", "specific"),
      R("Meghna T.", "Oct 2025", "Loved them. Everyone asked who we booked.", "none"),
      R("Arjun P.", "Sep 2025", "Priced higher than the others we shortlisted, worth it in the end.", "none"),
      R("Farida Q.", "Aug 2025", "Vocalist was ill and they told us four days ahead, sent a replacement recording to approve first. Handled properly.", "specific"),
    ],
  },
  {
    id: "marigold",
    name: "The Marigold Brass Co.",
    city: "Delhi NCR",
    kind: "14-piece baraat brass · processional, dhol",
    size: 14,
    booked: ["2026-12-05"],
    price: {
      performance: 98000, extraHour: 15000, sound: 20000, travelCity: 6000,
      outstation: 24000, earlySetup: null, dj: null,
      advancePct: 60, refundDays: 0, contract: false,
    },
    reviews: [
      R("Nikhil B.", "Mar 2026", "Best baraat entry on our street in years. The dhol players were unreal.", "none"),
      R("Preeti A.", "Feb 2026", "Twelve of the fourteen musicians we were shown did not turn up. They sent juniors instead and would not adjust the price. Our 60% advance was already paid and they refused to return any of it.", "negative", "substitution"),
      R("Rohan D.", "Feb 2026", "Loud, fun, exactly the vibe we wanted for the procession.", "none"),
      R("Simran V.", "Jan 2026", "Good value compared to quotes we got elsewhere.", "none"),
      R("Tarun G.", "Jan 2026", "On time and set up quickly.", "specific"),
      R("Ishita M.", "Dec 2025", "Everyone danced. Would recommend for a baraat.", "none"),
      R("Yash K.", "Dec 2025", "Really strong performers.", "none"),
      R("Anita L.", "Nov 2025", "The trumpet solo was lovely.", "none"),
      R("Vikram S.", "Nov 2025", "Turned up on schedule, played the full route.", "specific"),
      R("Neha C.", "Oct 2025", "Great for the money.", "none"),
      R("Gaurav T.", "Oct 2025", "Fantastic energy, five stars.", "none"),
      R("Pooja N.", "Sep 2025", "Booking over WhatsApp was easy, no paperwork though.", "none"),
    ],
  },
  {
    id: "anhad",
    name: "Anhad Live",
    city: "Jaipur",
    kind: "6-piece live band · Sufi, ghazal, acoustic",
    size: 6,
    booked: [],
    price: {
      performance: 72000, extraHour: 12000, sound: 14000, travelCity: 3000,
      outstation: 15000, earlySetup: 5000, dj: null,
      advancePct: 30, refundDays: 30, contract: true,
    },
    reviews: [
      R("Shalini M.", "Apr 2026", "Beautiful voices. Our mehndi felt like a private concert.", "none"),
      R("Ayaan R.", "Mar 2026", "New band but very professional with us over email.", "none"),
      R("Divya K.", "Feb 2026", "Lovely set, would book again.", "none"),
    ],
  },
  {
    id: "baaraat",
    name: "Baaraat Beats Bandwalla",
    city: "Delhi NCR",
    kind: "12-piece band + brass · Bollywood, bhangra",
    size: 12,
    booked: ["2026-11-21", "2026-11-28"],
    price: {
      performance: 112000, extraHour: 18000, sound: "included", travelCity: 4000,
      outstation: 20000, earlySetup: 6000, dj: 18000,
      advancePct: 50, refundDays: 21, contract: true,
    },
    reviews: [
      R("Manav S.", "Mar 2026", "Turned up 90 minutes late. The mandap was ready and guests were seated with nothing happening.", "negative"),
      R("Ekta B.", "Mar 2026", "On time, set up early, played right through.", "specific"),
      R("Rahul V.", "Feb 2026", "Arrived when they said they would. No issues at all.", "specific"),
      R("Jyoti P.", "Feb 2026", "They were late for the sangeet but made up for it by playing an extra half hour.", "negative"),
      R("Amitav N.", "Jan 2026", "Musicians were excellent, crowd loved it.", "none"),
      R("Sneha R.", "Jan 2026", "Two of the singers were different from the ones we auditioned. They did tell us a week before.", "negative"),
      R("Kunal M.", "Dec 2025", "Solid band, good song range.", "none"),
      R("Ridhi T.", "Dec 2025", "Punctual and easy to coordinate with our planner.", "specific"),
    ],
  },
  {
    id: "nauras",
    name: "Nauras Ensemble",
    city: "Mumbai",
    kind: "8-piece live band · jazz, retro Bollywood",
    size: 8,
    booked: ["2026-12-12"],
    price: {
      performance: 165000, extraHour: 26000, sound: "included", travelCity: 0,
      outstation: 30000, earlySetup: "included", dj: 30000,
      advancePct: 35, refundDays: 60, contract: true,
    },
    reviews: [
      R("Farhan A.", "Apr 2026", "Load-in three hours early, full sound check, started on the minute.", "specific"),
      R("Tanvi D.", "Mar 2026", "Exactly the line-up in the contract, all eight of them.", "specific"),
      R("Zoya H.", "Mar 2026", "The saxophonist alone was worth the fee.", "none"),
      R("Nitin K.", "Feb 2026", "Monsoon shifted our venue indoors two days before and they re-planned the setup without complaint or extra cost.", "specific"),
      R("Aditi J.", "Feb 2026", "Expensive, but nothing went wrong all evening.", "specific"),
      R("Rushil B.", "Jan 2026", "Very polished. Our older guests loved the retro set.", "none"),
      R("Leena M.", "Dec 2025", "Played the booked set list, finished on time, packed down quietly during dinner.", "specific"),
    ],
  },
  {
    id: "rangeen",
    name: "Rangeen Roadshow",
    city: "Chandigarh",
    kind: "9-piece band · pop, bhangra, DJ hybrid",
    size: 9,
    booked: [],
    price: {
      performance: 88000, extraHour: 14000, sound: 16000, travelCity: 5000,
      outstation: 17000, earlySetup: null, dj: 14000,
      advancePct: 50, refundDays: 15, contract: true,
    },
    reviews: [
      R("Gurpreet S.", "Apr 2026", "Dance floor was full from the first song.", "none"),
      R("Meera K.", "Mar 2026", "Song selection was perfect for a mixed-age crowd.", "none"),
      R("Vivek T.", "Mar 2026", "Good sound quality, decent lights.", "none"),
      R("Anjali R.", "Feb 2026", "Five stars, so much fun.", "none"),
      R("Sahil M.", "Feb 2026", "Slightly pricey for Chandigarh but they delivered a good show.", "none"),
      R("Kirti B.", "Jan 2026", "Loved the bhangra medley.", "none"),
      R("Deepak N.", "Jan 2026", "Nice people to deal with.", "none"),
      R("Ruchi A.", "Dec 2025", "Great atmosphere at the reception.", "none"),
      R("Ashwin P.", "Dec 2025", "Would recommend to friends.", "none"),
      R("Nisha V.", "Nov 2025", "Really enjoyed the evening.", "none"),
      R("Tejas L.", "Nov 2025", "Good band, good energy.", "none"),
    ],
  },
  {
    id: "qissa",
    name: "Qissa Qawwali Party",
    city: "Lucknow",
    kind: "7-piece qawwali party · traditional",
    size: 7,
    booked: [],
    price: {
      performance: 64000, extraHour: 10000, sound: 12000, travelCity: 2500,
      outstation: 14000, earlySetup: null, dj: null,
      advancePct: 25, refundDays: 30, contract: false,
    },
    reviews: [
      R("Sadia F.", "Mar 2026", "Moving performance, the whole family was in tears by the end.", "none"),
      R("Imran Q.", "Jan 2026", "Traditional and authentic, exactly what we hoped for.", "none"),
    ],
  },
  {
    id: "dhun",
    name: "Dhun Sangam Orchestra",
    city: "Delhi NCR",
    kind: "16-piece orchestra · film songs, live strings",
    size: 16,
    booked: ["2026-11-28"],
    price: {
      performance: 190000, extraHour: 28000, sound: 28000, travelCity: 8000,
      outstation: 35000, earlySetup: 10000, dj: 22000,
      advancePct: 55, refundDays: 0, contract: false,
    },
    reviews: [
      R("Suresh & Kamala", "Feb 2026", "They did not arrive. No call, no message. We ran the reception on a phone playlist and never saw the advance again.", "negative", "no-show"),
      R("Priya M.", "Feb 2026", "Sixteen musicians on stage is a real spectacle.", "none"),
      R("Hemant R.", "Jan 2026", "String section was gorgeous.", "none"),
      R("Bhavna S.", "Jan 2026", "Started an hour late but played beautifully once they did.", "negative"),
      R("Lalit K.", "Dec 2025", "Impressive scale for the price.", "none"),
      R("Reema J.", "Dec 2025", "Guests were amazed.", "none"),
      R("Om Prakash T.", "Nov 2025", "Very grand, good for a large venue.", "none"),
    ],
  },
];

/* ---------- reliability: pure, deterministic, no model ---------- */

const GATE = 5; // usable reviews required before any trust claim is reachable

function assess(band) {
  const rs = band.reviews;
  const flags = rs.filter((r) => r.flag);
  const specific = rs.filter((r) => r.reliability === "specific");
  const negative = rs.filter((r) => r.reliability === "negative");
  const onTopic = specific.length + negative.length;

  const base = { total: rs.length, onTopic, specific, negative, flags, gate: GATE };

  // Flagged is checked first and is never averaged against volume.
  if (flags.length) {
    const kinds = [...new Set(flags.map((f) => f.flag))];
    return {
      ...base, tier: "flagged", label: "Flagged", color: C.crimson,
      headline: `${flags.length} report${flags.length > 1 ? "s" : ""} of ${kinds.join(" and ")}`,
      body: `Shown regardless of the ${rs.length - flags.length} other reviews. A single credible report of this kind is not cancelled out by positive ones, because you cannot get the day back.`,
    };
  }
  if (onTopic < GATE) {
    return {
      ...base, tier: "limited", label: "Limited info", color: C.mute,
      headline: `${onTopic} of ${GATE} reviews needed`,
      body: onTopic === 0
        ? `${rs.length} review${rs.length === 1 ? "" : "s"}, none of which say anything about whether the band turned up or played what was booked. There is no trust claim to make here.`
        : `Only ${onTopic} of ${rs.length} reviews mention reliability. That is not enough to tell you anything, and a score here would be a guess dressed as a fact.`,
    };
  }
  if (negative.length) {
    return {
      ...base, tier: "mixed", label: "Mixed", color: C.marigold,
      headline: `${specific.length} clean, ${negative.length} with problems`,
      body: "Reviewers disagree on reliability. Both sides are below — read them rather than trusting an average of them.",
    };
  }
  return {
    ...base, tier: "consistent", label: "Consistent", color: C.green,
    headline: `${specific.length} reviews, no reliability complaints`,
    body: "Multiple reviewers name specific things that went right: arriving early, the booked musicians appearing, playing the full set.",
  };
}

/* ---------- helpers ---------- */

const inr = (n) => "₹" + n.toLocaleString("en-IN");
const prettyDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const isFree = (band, date) => !date || !band.booked.includes(date);

const LINE_ITEMS = [
  { key: "performance", label: "Performance, 3 hours" },
  { key: "extraHour", label: "Each additional hour" },
  { key: "sound", label: "Sound system and lights" },
  { key: "travelCity", label: "Travel within city" },
  { key: "outstation", label: "Outstation travel" },
  { key: "earlySetup", label: "Early load-in and sound check" },
  { key: "dj", label: "DJ between live sets" },
];

const renderAmount = (v) => {
  if (v === null || v === undefined) return { text: "Not offered", absent: true };
  if (v === "included") return { text: "Included", absent: false };
  if (v === 0) return { text: "No charge", absent: false };
  return { text: inr(v), absent: false };
};

/* ---------- evidence meter ---------- */

function Meter({ a }) {
  const filled = Math.min(a.onTopic, GATE);
  const over = Math.max(0, a.onTopic - GATE);
  return (
    <div className="bmb-meter" style={{ color: a.color }} aria-hidden="true">
      {Array.from({ length: GATE }, (_, i) => (
        <span key={i} className={"bmb-slot" + (i < filled ? " bmb-slot--full" : "")} />
      ))}
      {over > 0 && Array.from({ length: Math.min(over, 4) }, (_, i) => (
        <span key={"o" + i} className="bmb-slot bmb-slot--full bmb-slot--over" />
      ))}
    </div>
  );
}

function Signal({ a, compact }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Meter a={a} />
        <span className="bmb-tier" style={{ color: a.color }}>{a.label}</span>
      </div>
      <div className="bmb-meta" style={{ marginTop: 6 }}>{a.headline}</div>
      {!compact && <p className="bmb-note" style={{ margin: "10px 0 0" }}>{a.body}</p>}
    </div>
  );
}

/* ---------- boot ----------
   The splash plays the authored BootLogo piece itself rather than a
   reduced copy of it: same mandap, garland, shehnai fanfare and
   wordmark. Rendered at the size it was composed for and scaled to
   fit, so the logo reads identically at any viewport, and played once
   through instead of looped.
*/

const BOOT_DESIGN = { w: 400, h: 711 };  // 9:16 at the width the piece is drawn 1:1
const BOOT_SPEED = 1.7;                  // the authored timeline is ~8s; a splash should not be

function Boot({ onDone }) {
  const [T, setT] = useState(0);
  const [vp, setVp] = useState(() => ({
    w: typeof window === "undefined" ? BOOT_DESIGN.w : window.innerWidth,
    h: typeof window === "undefined" ? BOOT_DESIGN.h : window.innerHeight,
  }));
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onDone(); } };

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { finish(); return; }
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const t = ((now - t0) / 1000) * BOOT_SPEED;
      setT(t);
      if (t < AUTHORED_TOTAL) raf = requestAnimationFrame(tick); else finish();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Dissolve the field over the authored Reset beat, so the splash hands
  // over to the app rather than cutting to it.
  const fadeFrom = CUES.Reset + 0.15;
  const fade = 1 - Math.min(Math.max((T - fadeFrom) / (AUTHORED_TOTAL - fadeFrom), 0), 1);

  // The field fills the viewport; the logo is sized against the frame it
  // was composed in, so a wide screen gets more field rather than a
  // stretched mark — and there is no letterbox edge to give away a box.
  const frame = { w: Math.min(vp.w, BOOT_DESIGN.w), h: BOOT_DESIGN.h };

  return (
    <div
      onClick={finish}
      role="button"
      tabIndex={0}
      aria-label="Skip intro"
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " " || e.key === "Escape") finish(); }}
      style={{ position: "fixed", inset: 0, cursor: "pointer", opacity: fade, overflow: "hidden" }}
    >
      <Piece T={T} C={CUES} w={vp.w} h={vp.h} frame={frame} bg={FIELDS["#A61217"]} tagline />
      <div className="bmb-eyebrow" style={{
        position: "absolute", left: 0, right: 0, bottom: 28, textAlign: "center",
        color: C.goldLite, opacity: 0.75, pointerEvents: "none",
      }}>Tap to skip</div>
    </div>
  );
}

/* ---------- auth ----------
   Identity comes from Supabase (Google OAuth, or a passwordless email
   link). The phone number is a profile field, not a credential: bands
   need a number to ring, but verifying it by SMS costs money per login
   and requires TRAI DLT registration in India. Wrong trade for a
   once-in-a-lifetime purchase.
*/

const validPhone = (p) => /^[6-9]\d{9}$/.test(p);

function Auth({ reason, onClose, onSignedIn }) {
  const [step, setStep] = useState("choose"); // choose | email-sent | busy
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true); setErr("");
    try {
      const r = await signInWithGoogle();
      if (r?.mocked) onSignedIn();           // no keys: straight through
    } catch (e) {
      setErr(e.message || "Google sign-in did not start. Try the email link instead.");
      setBusy(false);
    }
  };

  const emailLink = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setErr("That address is missing something — check for a typo before we send the link.");
      return;
    }
    setBusy(true); setErr("");
    try {
      const r = await sendEmailLink(email);
      if (r?.mocked) { onSignedIn(); return; }
      setStep("email-sent");
    } catch (e) {
      setErr(e.message || "The link could not be sent. Check the address, or use Google instead.");
    }
    setBusy(false);
  };

  return (
    <div className="bmb-scrim" onClick={onClose}>
      <div className="bmb-sheet" role="dialog" aria-modal="true" aria-label="Sign in" onClick={(e) => e.stopPropagation()}>
        {step === "choose" && (
          <>
            <h2 className="bmb-h2" style={{ margin: "0 0 6px" }}>Sign in to send this</h2>
            <p className="bmb-note" style={{ marginBottom: 18 }}>
              {reason || "One account, whether you have been here before or not. No password to remember."}
            </p>

            <button className="bmb-btn bmb-btn--ghost" onClick={google} disabled={busy}
              style={{ marginBottom: 16, fontWeight: 600 }}>
              <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.5 2.7-3.8 2.7-6.5z" />
                <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H1v2.3A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H1a9 9 0 0 0 0 8l2.9-2.3z" />
                <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 1 5l2.9 2.3C4.6 5.1 6.6 3.6 9 3.6z" />
              </svg>
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 16px" }}>
              <div style={{ flex: 1, height: 1, background: C.rule }} />
              <span className="bmb-eyebrow">or</span>
              <div style={{ flex: 1, height: 1, background: C.rule }} />
            </div>

            <label className="bmb-label" htmlFor="bmb-email">Email</label>
            <input id="bmb-email" className="bmb-input" type="email" autoComplete="email"
              value={email} placeholder="you@example.in"
              onChange={(e) => { setEmail(e.target.value); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && emailLink()} />
            {err && <p className="bmb-error">{err}</p>}
            <div style={{ marginTop: 14 }}>
              <button className="bmb-btn" onClick={emailLink} disabled={busy}>
                {busy ? "Working…" : "Email me a sign-in link"}
              </button>
            </div>

            {!IS_LIVE && (
              <div className="bmb-demo">
                No Supabase keys found, so this is running against the in-memory store. Either button signs you
                straight in. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use the real thing.
              </div>
            )}
          </>
        )}

        {step === "email-sent" && (
          <>
            <h2 className="bmb-h2" style={{ margin: "0 0 6px" }}>Check {email}</h2>
            <p className="bmb-note">
              The link signs you in and brings you back to this page. It works once and expires in an hour.
              Nothing was sent to your number and no password was created.
            </p>
            <div style={{ marginTop: 18 }}>
              <button className="bmb-btn bmb-btn--ghost" onClick={() => setStep("choose")}>Use a different address</button>
            </div>
          </>
        )}

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button className="bmb-link" onClick={onClose}>Keep browsing without an account</button>
        </div>
      </div>
    </div>
  );
}

/* Collected after identity is established, because a band cannot reply
   to an email address at 11pm the night before a wedding. */
function PhoneStep({ session, onSaved, onSkip }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (name.trim().length < 2) { setErr("Bands need a name to put on the enquiry."); return; }
    if (!validPhone(phone)) { setErr("Enter a 10-digit Indian mobile, without +91 or spaces."); return; }
    setBusy(true); setErr("");
    try {
      const p = await saveProfile(session.userId, { name: name.trim(), phone, email: session.email });
      onSaved(p);
    } catch (e) {
      setErr(e.message || "That did not save. Try again in a moment.");
      setBusy(false);
    }
  };

  return (
    <div className="bmb-scrim">
      <div className="bmb-sheet" role="dialog" aria-modal="true" aria-label="Your details">
        <div className="bmb-eyebrow">Last step</div>
        <h2 className="bmb-h2" style={{ margin: "8px 0 6px" }}>How should the band reach you?</h2>
        <p className="bmb-note" style={{ marginBottom: 18 }}>
          Your name and number go on the enquiry. Nothing else — no email list, and your number is never shown
          publicly on the site.
        </p>
        <label className="bmb-label" htmlFor="bmb-pname">Your name</label>
        <input id="bmb-pname" className="bmb-input" value={name} placeholder="Aarav Mehta"
          style={{ marginBottom: 14 }}
          onChange={(e) => { setName(e.target.value); setErr(""); }} />
        <label className="bmb-label" htmlFor="bmb-pphone">Mobile number</label>
        <div className="bmb-phone">
          <span>+91</span>
          <input id="bmb-pphone" className="bmb-input" style={{ borderRadius: "0 2px 2px 0" }}
            type="tel" inputMode="numeric" maxLength={10} value={phone} placeholder="98110 12345"
            onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && save()} />
        </div>
        {err && <p className="bmb-error">{err}</p>}
        <div style={{ marginTop: 18 }}>
          <button className="bmb-btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
        </div>
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button className="bmb-link" onClick={onSkip}>Not now</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- screens ---------- */

const CITIES = ["All cities", "Delhi NCR", "Jaipur", "Mumbai", "Chandigarh", "Lucknow"];

function Search({ date, setDate, city, setCity, onSearch }) {
  return (
    <div className="bmb-rise">
      <div className="bmb-eyebrow">Wedding season 2026</div>
      <h1 className="bmb-h1">Find out what a band costs and whether they turn up — before you enquire.</h1>
      <p className="bmb-lede">
        Every price below is broken into the same line items, so you can actually compare them.
        Availability is checked against the band's calendar, not promised in a reply three days later.
      </p>
      <div style={{ marginBottom: 16 }}>
        <label className="bmb-label" htmlFor="bmb-date">Your date</label>
        <input id="bmb-date" className="bmb-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label className="bmb-label" htmlFor="bmb-city">Where</label>
        <select id="bmb-city" className="bmb-select" value={city} onChange={(e) => setCity(e.target.value)}>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button className="bmb-btn" onClick={onSearch}>Show bands</button>
    </div>
  );
}

function Results({ date, city, onOpen, onBack }) {
  const [hideBooked, setHideBooked] = useState(true);

  const list = useMemo(() => {
    let l = SEED.filter((b) => city === "All cities" || b.city === city);
    l = l.map((b) => ({ band: b, a: assess(b), free: isFree(b, date) }));
    if (hideBooked) l = l.filter((x) => x.free);
    const order = { flagged: 3, limited: 2, mixed: 1, consistent: 0 };
    return l.sort((x, y) => order[x.a.tier] - order[y.a.tier] || x.band.price.performance - y.band.price.performance);
  }, [city, date, hideBooked]);

  const bookedCount = SEED.filter((b) => (city === "All cities" || b.city === city) && !isFree(b, date)).length;

  return (
    <div className="bmb-rise">
      <button className="bmb-link" onClick={onBack} style={{ marginBottom: 14 }}>← Change date or city</button>
      <div className="bmb-eyebrow">{prettyDate(date)} · {city}</div>
      <h1 className="bmb-h1" style={{ fontSize: 25 }}>{list.length} band{list.length === 1 ? "" : "s"} free on your date</h1>
      {bookedCount > 0 && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: C.inkSoft, marginBottom: 20, cursor: "pointer" }}>
          <input type="checkbox" checked={hideBooked} onChange={(e) => setHideBooked(e.target.checked)} />
          Hide the {bookedCount} already booked that day
        </label>
      )}

      {list.length === 0 && (
        <div className="bmb-panel">
          <h2 className="bmb-h2">Nothing free on {prettyDate(date)}</h2>
          <p className="bmb-note" style={{ marginBottom: 0 }}>Try a nearby date, or widen the search to all cities. Saturdays in November and December go first.</p>
        </div>
      )}

      {list.map(({ band, a, free }) => {
        const item = renderAmount(band.price.performance);
        return (
          <button
            key={band.id}
            className={"bmb-card" + (a.tier === "flagged" ? " bmb-card--flagged" : "")}
            onClick={() => onOpen(band.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
              <h2 className="bmb-h2">{band.name}</h2>
              <span style={{ fontFamily: FONT_DATA, fontSize: 14, whiteSpace: "nowrap" }}>{item.text}</span>
            </div>
            <div className="bmb-meta" style={{ margin: "5px 0 12px" }}>{band.kind}</div>
            <Signal a={a} compact />
            {!free && <div className="bmb-meta" style={{ marginTop: 10, color: C.crimson }}>Booked on {prettyDate(date)}</div>}
          </button>
        );
      })}

      <p className="bmb-note" style={{ marginTop: 22 }}>
        Sorted by what you need to know first: anything flagged or thin on evidence appears above the safe bets, not below them.
      </p>
    </div>
  );
}

function Band({ band, date, onBack, user, enquiries, onEnquire, onNeedAuth }) {
  const a = assess(band);
  const [tab, setTab] = useState("signal");
  const free = isFree(band, date);
  const sent = (enquiries || []).some((e) => e.band_id === band.id && e.event_date === date);

  const evidence = [...a.flags, ...a.negative.filter((r) => !r.flag), ...a.specific];

  return (
    <div className="bmb-rise">
      <button className="bmb-link" onClick={onBack} style={{ marginBottom: 14 }}>← Back to results</button>
      <div className="bmb-eyebrow">{band.city}</div>
      <h1 className="bmb-h1" style={{ marginBottom: 4 }}>{band.name}</h1>
      <div className="bmb-meta" style={{ marginBottom: 18 }}>{band.kind}</div>

      <div className={"bmb-panel" + (a.tier === "flagged" ? " bmb-panel--flag" : "")}>
        <Signal a={a} />
      </div>

      <div className="bmb-panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <div className="bmb-eyebrow">{prettyDate(date)}</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginTop: 4, color: free ? C.green : C.crimson }}>
            {free ? "Free — confirmed against their calendar" : "Already booked"}
          </div>
        </div>
      </div>

      <div className="bmb-tabs" role="tablist">
        {[["signal", "Evidence"], ["price", "Price"], ["reviews", `All ${band.reviews.length} reviews`]].map(([k, l]) => (
          <button key={k} className="bmb-tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "signal" && (
        <div>
          {evidence.length === 0 ? (
            <p className="bmb-note">
              No review says anything about arrival, line-up or set length. Read all {band.reviews.length} reviews
              yourself under the next tab — but expect them to be about the music, not the logistics.
            </p>
          ) : (
            <>
              <p className="bmb-note" style={{ marginBottom: 14 }}>
                The {evidence.length} review{evidence.length === 1 ? "" : "s"} that actually mention reliability. Everything
                else is filed under all reviews.
              </p>
              {evidence.map((r, i) => {
                const tone = r.flag ? C.crimson : r.reliability === "negative" ? C.marigold : C.green;
                const tag = r.flag ? r.flag : r.reliability === "negative" ? "problem reported" : "went to plan";
                return (
                  <div key={i} className="bmb-quote" style={{ borderLeftColor: tone }}>
                    <span className="bmb-tag" style={{ color: tone }}>{tag}</span>
                    <p style={{ margin: "6px 0 6px" }}>{r.text}</p>
                    <span className="bmb-meta">{r.author} · {r.date}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {tab === "price" && (
        <div>
          <p className="bmb-note" style={{ marginBottom: 14 }}>
            Same seven line items for every band on the site. Anything a band does not offer is ruled out here rather than
            left off, so a short quote never looks like a cheap one.
          </p>
          <table className="bmb-ledger">
            <tbody>
              {LINE_ITEMS.map(({ key, label }) => {
                const v = renderAmount(band.price[key]);
                return (
                  <tr key={key} className={v.absent ? "is-absent" : ""}>
                    <td>{label}</td>
                    <td>{v.text}</td>
                  </tr>
                );
              })}
              <tr className="is-total">
                <td>Typical evening, 3 hours, in city</td>
                <td>{inr(band.price.performance + (typeof band.price.sound === "number" ? band.price.sound : 0) + (typeof band.price.travelCity === "number" ? band.price.travelCity : 0))}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 20 }}>
            <div className="bmb-eyebrow" style={{ marginBottom: 8 }}>Terms</div>
            <table className="bmb-ledger">
              <tbody>
                <tr><td>Advance on booking</td><td>{band.price.advancePct}%</td></tr>
                <tr className={band.price.refundDays === 0 ? "is-absent" : ""}>
                  <td>Advance refundable up to</td>
                  <td>{band.price.refundDays === 0 ? "Non-refundable" : band.price.refundDays + " days before"}</td>
                </tr>
                <tr className={band.price.contract ? "" : "is-absent"}>
                  <td>Written contract</td>
                  <td>{band.price.contract ? "Yes" : "Not offered"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "reviews" && (
        <div>
          <p className="bmb-note" style={{ marginBottom: 14 }}>
            Everything, unfiltered and newest first — including the {band.reviews.length - a.onTopic} that say nothing
            about reliability. The tag shows how each one was counted.
          </p>
          {band.reviews.map((r, i) => {
            const tone = r.flag ? C.crimson : r.reliability === "negative" ? C.marigold : r.reliability === "specific" ? C.green : C.mute;
            const tag = r.flag ? r.flag : r.reliability === "negative" ? "problem reported" : r.reliability === "specific" ? "went to plan" : "not about reliability";
            return (
              <div key={i} className="bmb-quote" style={{ borderLeftColor: tone }}>
                <span className="bmb-tag" style={{ color: tone }}>{tag}</span>
                <p style={{ margin: "6px 0 6px" }}>{r.text}</p>
                <span className="bmb-meta">{r.author} · {r.date}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        {sent ? (
          <div className="bmb-panel" style={{ marginBottom: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18 }}>Enquiry sent for {prettyDate(date)}</div>
            <p className="bmb-note" style={{ margin: "6px 0 0" }}>
              {band.name} has your name, your number and the price breakdown you saw. Nothing is paid and nothing is held yet.
            </p>
          </div>
        ) : (
          <>
            <button className={"bmb-btn" + (free ? "" : " bmb-btn--ghost")} disabled={!free}
              onClick={() => (user ? onEnquire(band.id) : onNeedAuth(band.id))}
              style={!free ? { cursor: "not-allowed", opacity: 0.55 } : undefined}>
              {free ? `Enquire about ${prettyDate(date)}` : "Not free on this date"}
            </button>
            {free && (
              <p className="bmb-note" style={{ margin: "10px 0 0", textAlign: "center" }}>
                {user
                  ? `Sending as ${user.name}, +91 ${user.phone}`
                  : "Takes a mobile number and a one-time code. No account needed to browse."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Account({ user, enquiries, onBack, onOpen, onSignOut }) {
  const ago = (iso) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 14) return `${days} days ago`;
    return `${Math.floor(days / 7)} weeks ago`;
  };

  return (
    <div className="bmb-rise">
      <button className="bmb-link" onClick={onBack} style={{ marginBottom: 14 }}>← Back to bands</button>
      <div className="bmb-eyebrow">{user.phone ? `+91 ${user.phone}` : user.email}</div>
      <h1 className="bmb-h1" style={{ fontSize: 25 }}>{user.name}</h1>

      <div className="bmb-eyebrow" style={{ margin: "18px 0 10px" }}>Your enquiries</div>
      {enquiries.length === 0 ? (
        <div className="bmb-panel">
          <p className="bmb-note" style={{ margin: 0 }}>
            Nothing sent yet. Enquiries you send will sit here with the date and the total you were quoted at the
            time, so you have a record if a price changes later.
          </p>
        </div>
      ) : (
        enquiries.map((e) => {
          const b = SEED.find((x) => x.id === e.band_id);
          return (
            <button key={e.id} className="bmb-card" onClick={() => onOpen(e.band_id)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <h2 className="bmb-h2">{b ? b.name : e.band_id}</h2>
                <span className="bmb-meta">{ago(e.created_at)}</span>
              </div>
              <div className="bmb-meta" style={{ marginTop: 5 }}>
                Enquired for {prettyDate(e.event_date)}
                {e.quoted_total ? ` · quoted ${inr(e.quoted_total)}` : ""}
              </div>
            </button>
          );
        })
      )}

      <div style={{ marginTop: 24 }}>
        <button className="bmb-btn bmb-btn--ghost" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}

/* ---------- app ---------- */

export default function BookMyBand() {
  const [screen, setScreen] = useState("boot");
  const [date, setDate] = useState("2026-11-21");
  const [city, setCity] = useState("Delhi NCR");
  const [openId, setOpenId] = useState(null);

  const [session, setSession] = useState(null);   // { userId, email }
  const [profile, setProfile] = useState(null);   // { name, phone }
  const [enquiries, setEnquiries] = useState([]);
  const [needPhone, setNeedPhone] = useState(false);
  const [auth, setAuth] = useState(null);         // null | { reason, pendingBandId }
  const pending = useRef(null);

  const band = SEED.find((b) => b.id === openId);
  const user = session && profile ? { ...profile, email: session.email } : null;

  /* Pick up an OAuth or email-link return, then load whatever session exists. */
  useEffect(() => {
    let live = true;
    (async () => {
      const s = (await consumeRedirect()) || (await getSession());
      if (!live || !s) return;
      setSession(s);
      const [p, es] = await Promise.all([getProfile(s.userId), listEnquiries(s.userId)]);
      if (!live) return;
      setEnquiries(es || []);
      if (p) setProfile(p); else setNeedPhone(true);
    })();
    return () => { live = false; };
  }, []);

  const loadAfterSignIn = async () => {
    const s = await getSession();
    if (!s) return;
    setSession(s);
    const [p, es] = await Promise.all([getProfile(s.userId), listEnquiries(s.userId)]);
    setEnquiries(es || []);
    if (p) { setProfile(p); await flushPending(s.userId); }
    else setNeedPhone(true);
  };

  const quotedTotal = (b) =>
    b.price.performance +
    (typeof b.price.sound === "number" ? b.price.sound : 0) +
    (typeof b.price.travelCity === "number" ? b.price.travelCity : 0);

  const send = async (userId, bandId) => {
    const b = SEED.find((x) => x.id === bandId);
    const row = await createEnquiry(userId, { bandId, date, quotedTotal: quotedTotal(b) });
    setEnquiries((prev) => [row, ...prev.filter((e) => e.id !== row.id)]);
  };

  const flushPending = async (userId) => {
    const bandId = pending.current;
    pending.current = null;
    if (bandId) await send(userId, bandId);
  };

  const onSignedIn = () => { setAuth(null); loadAfterSignIn(); };

  const doSignOut = async () => {
    await signOut();
    setSession(null); setProfile(null); setEnquiries([]); setScreen("search");
  };

  return (
    <div className="bmb">
      <style>{CSS}</style>
      {screen === "boot" && <Boot onDone={() => setScreen("search")} />}
      {screen !== "boot" && (
        <div className="bmb-wrap">
          <div className="bmb-topbar">
            <button className="bmb-logo" onClick={() => setScreen("search")}
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit" }}>
              Book<em>My</em>Band
            </button>
            {user ? (
              <button className="bmb-avatar" onClick={() => setScreen("account")}
                title={`${user.name} — your account`} aria-label={`${user.name}, your account`}>
                {user.name.charAt(0).toUpperCase()}
              </button>
            ) : (
              <button className="bmb-link" onClick={() => setAuth({ reason: null })}>Sign in</button>
            )}
          </div>
          <div style={{ paddingTop: 22 }}>
            {screen === "search" && (
              <Search date={date} setDate={setDate} city={city} setCity={setCity} onSearch={() => setScreen("results")} />
            )}
            {screen === "results" && (
              <Results date={date} city={city} onBack={() => setScreen("search")}
                onOpen={(id) => { setOpenId(id); setScreen("band"); }} />
            )}
            {screen === "band" && band && (
              <Band band={band} date={date} user={user} enquiries={enquiries}
                onBack={() => setScreen("results")}
                onEnquire={(id) => send(session.userId, id)}
                onNeedAuth={(id) => {
                  pending.current = id;
                  setAuth({ reason: `${band.name} needs a way to reply about ${prettyDate(date)}.` });
                }} />
            )}
            {screen === "account" && user && (
              <Account user={user} enquiries={enquiries} onBack={() => setScreen("results")}
                onOpen={(id) => { setOpenId(id); setScreen("band"); }}
                onSignOut={doSignOut} />
            )}
          </div>
        </div>
      )}
      {auth && <Auth reason={auth.reason} onClose={() => { pending.current = null; setAuth(null); }} onSignedIn={onSignedIn} />}
      {needPhone && session && (
        <PhoneStep session={session}
          onSaved={async (p) => { setProfile(p); setNeedPhone(false); await flushPending(session.userId); }}
          onSkip={() => { pending.current = null; setNeedPhone(false); }} />
      )}
    </div>
  );
}
