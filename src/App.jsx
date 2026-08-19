import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  IS_LIVE, getSession, consumeRedirect, signInWithGoogle, sendEmailLink, signOut,
  getProfile, saveProfile, listEnquiries, createEnquiry,
} from "./lib/backend";
import { Piece, CUES, AUTHORED_TOTAL, FIELDS } from "./components/BootLogo.jsx";
import { SEED, GATE, assess as assessBand } from "./lib/seed.js";
import { ask, ASK_IS_LIVE } from "./lib/ask.js";

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

/* ask — the AI entry point. Gold, because it is the one thing here
   that is not a plain lookup. */
.bmb-ask-open {
  display: flex; align-items: center; gap: 11px; width: 100%; cursor: pointer;
  background: #FFFBF2; border: 1px solid ${C.gold}; border-radius: 2px;
  padding: 13px 14px; margin-bottom: 22px; font-family: inherit; text-align: left;
}
.bmb-ask-open:hover { background: ${C.cream}; }
.bmb-ask-open span { font-size: 14.5px; color: ${C.inkSoft}; }
.bmb-spark { flex: none; color: ${C.gold}; }

.bmb-ask-box {
  border: 1px solid ${C.gold}; border-radius: 2px; background: #FFFBF2;
  padding: 16px 15px; margin-bottom: 22px;
}
.bmb-ask-in {
  width: 100%; min-height: 66px; resize: vertical; padding: 11px 12px;
  font-family: ${FONT_BODY}; font-size: 15px; line-height: 1.5; color: ${C.ink};
  background: ${C.paper}; border: 1px solid ${C.rule}; border-radius: 2px;
}
.bmb-ask-in:focus-visible { outline: 2px solid ${C.field}; outline-offset: 2px; }
.bmb-chip {
  background: ${C.paperDeep}; border: 1px solid ${C.rule}; border-radius: 999px;
  padding: 5px 11px; font-size: 12.5px; color: ${C.ink}; cursor: pointer; font-family: inherit;
}
.bmb-chip:hover { border-color: ${C.gold}; background: ${C.cream}; }
.bmb-answer { font-size: 15px; line-height: 1.6; white-space: pre-wrap; margin: 0; }
.bmb-caveat {
  border-left: 3px solid ${C.crimson}; background: #FDF3EE;
  padding: 10px 12px; margin-top: 14px; font-size: 14px; line-height: 1.55;
}
.bmb-dots span {
  display: inline-block; width: 5px; height: 5px; border-radius: 50%;
  background: ${C.gold}; margin-right: 4px; animation: bmbBlink 1.1s infinite both;
}
.bmb-dots span:nth-child(2) { animation-delay: 0.16s; }
.bmb-dots span:nth-child(3) { animation-delay: 0.32s; }
@keyframes bmbBlink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .bmb-dots span { animation: none; opacity: 0.6; } }

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

/* ---------- reliability ----------
   Seed data and the assessment over it live in lib/seed.js so the ask
   feature retrieves from exactly what the screens render. Tier -> colour
   is the only part that belongs here. */

const TIER_COLOR = {
  flagged: C.crimson,
  limited: C.mute,
  mixed: C.marigold,
  consistent: C.green,
};

const assess = (band) => {
  const a = assessBand(band);
  return { ...a, color: TIER_COLOR[a.tier] };
};

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

/* ---------- ask ----------
   Plain-language questions answered from the seed set. Retrieval runs
   locally; the wording comes from Claude when an answer endpoint is
   configured, and from a deterministic reader of the same facts when
   it is not. Either way the abstention rules hold: nothing is claimed
   that the reviews do not evidence, and a flag is never averaged away.
*/

function Spark({ size = 17 }) {
  return (
    <svg className="bmb-spark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6l1.9 5.6 5.6 1.9-5.6 1.9L12 17.6l-1.9-5.6L4.5 10.1l5.6-1.9z"
        fill="currentColor" />
      <path d="M18.6 15.4l.85 2.5 2.5.85-2.5.85-.85 2.5-.85-2.5-2.5-.85 2.5-.85z"
        fill="currentColor" opacity="0.65" />
    </svg>
  );
}

const EXAMPLES = [
  "Which of these has actually turned up on the day?",
  "Brass band for a baraat in Delhi under ₹1 lakh",
  "Something sufi and intimate in Jaipur",
  "Is the cheapest one a risk?",
];

function Ask({ date, onOpenBand, onClose }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  // What the user has pinned down by answering follow-up questions.
  const [facets, setFacets] = useState([]);
  const [asked, setAsked] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const run = async (text, next = { facets, asked }) => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    setQ(question); setBusy(true); setErr(""); setRes(null);
    try {
      setRes(await ask(question, { date, facets: next.facets, asked: next.asked }));
    } catch (e) {
      setErr(e.message || "That did not come back. Try again in a moment.");
    }
    setBusy(false);
  };

  // Start over from the typed question, dropping anything pinned.
  const fresh = (text) => { setFacets([]); setAsked([]); run(text, { facets: [], asked: [] }); };

  // Answer the follow-up: fold it in and immediately try again.
  const answerClarify = (key, option) => {
    const nextFacets = [...facets, option];
    const nextAsked = [...asked, key];
    setFacets(nextFacets); setAsked(nextAsked);
    run(q, { facets: nextFacets, asked: nextAsked });
  };

  // A follow-up question carries no bandIds — guard, or this throws
  // before the render even reaches the clarify branch.
  const cited = (res?.bandIds || []).map((id) => SEED.find((b) => b.id === id)).filter(Boolean);

  return (
    <div className="bmb-ask-box">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Spark />
          <span className="bmb-eyebrow" style={{ color: C.ink }}>Ask about these bands</span>
        </div>
        <button className="bmb-link" onClick={onClose} style={{ fontSize: 13 }}>Close</button>
      </div>

      <textarea
        ref={inputRef}
        className="bmb-ask-in"
        value={q}
        placeholder="Describe what you need — a style, a city, a budget, or just what you are worried about."
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, margin: "11px 0 13px" }}>
        {EXAMPLES.map((x) => (
          <button key={x} className="bmb-chip" onClick={() => fresh(x)} disabled={busy}>{x}</button>
        ))}
      </div>

      {facets.length > 0 && (
        <div className="bmb-meta" style={{ marginBottom: 11 }}>
          Also using: {facets.join(" · ")}
          <button className="bmb-link" style={{ fontSize: 12.5, marginLeft: 9 }}
            onClick={() => fresh(q)}>clear</button>
        </div>
      )}

      <button className="bmb-btn" onClick={() => fresh(q)} disabled={busy || !q.trim()}
        style={busy || !q.trim() ? { opacity: 0.55, cursor: "not-allowed" } : undefined}>
        {busy ? "Reading the reviews…" : "Ask"}
      </button>

      {busy && (
        <div className="bmb-dots" style={{ marginTop: 14 }} aria-live="polite">
          <span /><span /><span />
        </div>
      )}

      {err && <p className="bmb-error">{err}</p>}

      {res?.clarify && (
        <div style={{ marginTop: 18 }} aria-live="polite">
          <p className="bmb-answer" style={{ marginBottom: 12 }}>{res.clarify.question}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {res.clarify.options.map((opt) => (
              <button key={opt} className="bmb-chip" disabled={busy}
                onClick={() => answerClarify(res.clarify.key, opt)}>{opt}</button>
            ))}
          </div>
          <p className="bmb-note" style={{ marginTop: 12 }}>
            One answer is usually enough to get to real results.
          </p>
        </div>
      )}

      {res && !res.clarify && (
        <div style={{ marginTop: 16 }} aria-live="polite">
          <p className="bmb-answer">{res.answer}</p>

          {res.caveat && <div className="bmb-caveat">{res.caveat}</div>}

          {cited.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="bmb-eyebrow" style={{ marginBottom: 9 }}>
                {cited.length === 1 ? "The band it read" : "The bands it read"}
              </div>
              {cited.map((band) => {
                const a = assess(band);
                return (
                  <button key={band.id}
                    className={"bmb-card" + (a.tier === "flagged" ? " bmb-card--flagged" : "")}
                    onClick={() => onOpenBand(band.id)}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                      <h2 className="bmb-h2" style={{ fontSize: 18 }}>{band.name}</h2>
                      <span style={{ fontFamily: FONT_DATA, fontSize: 13, whiteSpace: "nowrap" }}>
                        {inr(band.price.performance)}
                      </span>
                    </div>
                    <div className="bmb-meta" style={{ margin: "4px 0 9px" }}>{band.kind}</div>
                    <Signal a={a} compact />
                  </button>
                );
              })}
            </div>
          )}

          <p className="bmb-note" style={{ marginTop: 12 }}>
            Answered only from the {SEED.length} bands and their reviews in this demo — it cannot
            reach anything else, and it will say so rather than guess.
          </p>

          {!ASK_IS_LIVE && (
            <div className="bmb-demo">
              No answer endpoint configured, so this reply is composed locally from the same retrieved
              facts rather than by a model. Set VITE_ASK_ENDPOINT to route questions through Claude.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- screens ---------- */

const CITIES = ["All cities", "Delhi NCR", "Jaipur", "Mumbai", "Chandigarh", "Lucknow"];

function Search({ date, setDate, city, setCity, onSearch, onOpenBand }) {
  const [asking, setAsking] = useState(false);

  return (
    <div className="bmb-rise">
      <div className="bmb-eyebrow">Wedding season 2026</div>
      <h1 className="bmb-h1">Find out what a band costs and whether they turn up — before you enquire.</h1>
      <p className="bmb-lede">
        Every price below is broken into the same line items, so you can actually compare them.
        Availability is checked against the band's calendar, not promised in a reply three days later.
      </p>

      {asking ? (
        <Ask date={date} onOpenBand={onOpenBand} onClose={() => setAsking(false)} />
      ) : (
        <button className="bmb-ask-open" onClick={() => setAsking(true)}>
          <Spark size={19} />
          <span>Not sure where to start? Describe what you need.</span>
        </button>
      )}

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
              <Search date={date} setDate={setDate} city={city} setCity={setCity}
                onSearch={() => setScreen("results")}
                onOpenBand={(id) => { setOpenId(id); setScreen("band"); }} />
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
