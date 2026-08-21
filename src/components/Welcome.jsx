import React, { useState, useEffect, useMemo } from "react";
import { SEED } from "../lib/seed.js";

/* ============================================================
   Welcome — the screen between the boot animation and search.

   Built from the design canvas: a ken-burns photo carousel with
   story-style progress bars over a dark radial panel carrying the
   headline, the cities actually in the catalogue, and the CTA.

   Its palette is the boot screen's, deepened, so the splash hands
   over to something continuous rather than cutting from red to
   paper. Search still owns the light theme; this is the bridge.
   ============================================================ */

const C = {
  ground: "#26050A",
  panelTop: "#6A0F14",
  panelMid: "#3A070B",
  cream: "#FFF2D4",
  gold: "#F3C862",
  goldDeep: "#C08A24",
  marigold: "#FF9E1B",
  warm: "#E9C6A9",
  warmDim: "#C79A7C",
};

const DISPLAY = '"Marcellus", Georgia, "Times New Roman", serif';
const BODY = '"Jost", "Helvetica Neue", Helvetica, Arial, sans-serif';

const SLIDE_MS = 3400;

const SLIDES = [
  { src: "/welcome/live-band.jpeg", caption: "Live bands, real energy" },
  { src: "/welcome/baraat-umbrellas.jpeg", caption: "Grand baraat entries" },
  { src: "/welcome/mandap-floral.jpeg", caption: "Mandap styling, done right" },
  { src: "/welcome/buffet-1.jpeg", caption: "Curated catering partners" },
  { src: "/welcome/buffet-2.jpeg", caption: "Booked across five cities" },
];

const CSS = `
.bmb-w { position: fixed; inset: 0; display: flex; flex-direction: column;
  background: ${C.panelMid}; font-family: ${BODY}; overflow: hidden; }
.bmb-w-stage { position: relative; width: 100%; height: 38vh; min-height: 210px;
  flex-shrink: 0; overflow: hidden; background: #000; }
.bmb-w-slide { position: absolute; inset: 0; transition: opacity 900ms ease; }
.bmb-w-slide img { width: 100%; height: 100%; object-fit: cover; }
.bmb-w-slide--on img { animation: bmbKen ${SLIDE_MS}ms ease-out forwards; }
@keyframes bmbKen { from { transform: scale(1); } to { transform: scale(1.13); } }

.bmb-w-scrim { position: absolute; inset: 0; pointer-events: none; z-index: 3;
  background: linear-gradient(180deg, rgba(58,7,11,0) 38%, rgba(58,7,11,0.78) 80%, ${C.panelMid} 100%); }

.bmb-w-bars { position: absolute; top: 16px; left: 14px; right: 14px;
  display: flex; gap: 4px; z-index: 4; }
.bmb-w-bar { flex: 1; height: 3px; border-radius: 2px;
  background: rgba(255,255,255,0.28); overflow: hidden; }
.bmb-w-bar i { display: block; height: 100%; background: ${C.gold}; }
.bmb-w-bar i.is-run { animation: bmbFill ${SLIDE_MS}ms linear forwards; }
@keyframes bmbFill { from { width: 0%; } to { width: 100%; } }

.bmb-w-cap { position: absolute; bottom: 14px; left: 18px; right: 18px; z-index: 4;
  display: flex; align-items: center; gap: 6px; pointer-events: none;
  animation: bmbCapIn 500ms ease-out; }
@keyframes bmbCapIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.bmb-w-panel { position: relative; flex: 1; min-height: 0; display: flex;
  flex-direction: column; padding: 20px 24px 22px; overflow-y: auto;
  background: radial-gradient(120% 90% at 50% 0%, ${C.panelTop} 0%, ${C.panelMid} 55%, ${C.ground} 100%); }
/* The design is a phone screen. On anything wider, keep the copy and the
   CTA in one readable column rather than stretching them across the
   viewport — a full-width gold button reads as a mistake. */
.bmb-w-col { display: flex; flex-direction: column; flex: 1; min-height: 0;
  width: 100%; max-width: 460px; margin: 0 auto; }
.bmb-w-h1 { margin: 0 0 8px; font-family: ${DISPLAY}; font-size: clamp(25px, 7.4vw, 30px);
  line-height: 1.14; color: ${C.cream}; font-weight: 400; }
.bmb-w-h1 em { color: ${C.gold}; font-style: normal; }
.bmb-w-lede { margin: 0 0 16px; font-size: 13.5px; line-height: 1.5;
  color: ${C.warm}; max-width: 340px; }

.bmb-w-eyebrow { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.bmb-w-eyebrow span { font-size: 10px; letter-spacing: 0.16em;
  text-transform: uppercase; color: ${C.gold}; }
.bmb-w-dia { width: 8px; height: 8px; background: ${C.marigold}; transform: rotate(45deg); }

.bmb-w-pills { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 18px; }
.bmb-w-pill { font-size: 12px; color: ${C.cream}; background: rgba(243,200,98,0.12);
  border: 1px solid rgba(243,200,98,0.38); border-radius: 16px; padding: 5px 12px;
  white-space: nowrap; }

.bmb-w-foot { margin-top: auto; display: flex; flex-direction: column; gap: 10px;
  flex-shrink: 0; padding-top: 14px; }
.bmb-w-cta { border: none; border-radius: 14px; padding: 15px; cursor: pointer;
  background: linear-gradient(135deg, ${C.gold}, ${C.goldDeep}); color: #3A070B;
  font-family: ${BODY}; font-weight: 600; font-size: 15.5px; letter-spacing: 0.01em;
  box-shadow: 0 10px 26px rgba(0,0,0,0.35); }
.bmb-w-cta:hover { filter: brightness(1.05); }
.bmb-w-cta:active { transform: scale(0.98); }
.bmb-w-cta:focus-visible, .bmb-w-login:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 3px; }
.bmb-w-alt { text-align: center; font-size: 12px; color: ${C.warmDim}; }
.bmb-w-login { background: none; border: none; padding: 0; cursor: pointer;
  font-family: ${BODY}; font-size: 12px; color: ${C.gold}; font-weight: 500;
  text-decoration: underline; text-underline-offset: 3px; }

@media (prefers-reduced-motion: reduce) {
  .bmb-w-slide--on img, .bmb-w-bar i.is-run, .bmb-w-cap { animation: none; }
  .bmb-w-bar i.is-run { width: 100%; }
}
`;

export default function Welcome({ onStart, onLogin }) {
  const [idx, setIdx] = useState(0);
  // Bumped every advance so the ken-burns and bar-fill animations
  // restart via a changed key rather than needing to be reset.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % SLIDES.length);
      setTick((n) => n + 1);
    }, SLIDE_MS);
    return () => clearInterval(t);
  }, []);

  // The cities the catalogue can actually serve, not a hardcoded list
  // that quietly drifts from the seed data.
  const cities = useMemo(
    () => [...new Set(SEED.map((b) => b.city))].sort((a, b) => a.localeCompare(b)),
    []
  );

  return (
    <div className="bmb-w">
      <style>{CSS}</style>

      <div className="bmb-w-stage">
        {SLIDES.map((s, i) => (
          <div
            key={s.src}
            className={"bmb-w-slide" + (i === idx ? " bmb-w-slide--on" : "")}
            style={{ opacity: i === idx ? 1 : 0, zIndex: i === idx ? 2 : 1 }}
          >
            <img
              key={i === idx ? `on-${tick}` : "off"}
              src={s.src}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
            />
          </div>
        ))}

        <div className="bmb-w-scrim" />

        <div className="bmb-w-bars" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <div key={s.src} className="bmb-w-bar">
              <i
                key={i === idx ? `run-${tick}` : "idle"}
                className={i === idx ? "is-run" : ""}
                style={i < idx ? { width: "100%" } : i > idx ? { width: 0 } : undefined}
              />
            </div>
          ))}
        </div>

        <div className="bmb-w-cap" key={`cap-${tick}`}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, flexShrink: 0 }} />
          <span style={{ fontSize: 12, letterSpacing: "0.03em", color: C.cream, fontWeight: 500 }}>
            {SLIDES[idx].caption}
          </span>
        </div>
      </div>

      <div className="bmb-w-panel">
       <div className="bmb-w-col">
        <h1 className="bmb-w-h1">
          Live Bands,<br /><em>Booked in Minutes</em>
        </h1>

        <p className="bmb-w-lede">
          Find out what a band costs and whether they actually turn up — before you enquire.
          Every price is broken into the same line items, availability is checked against the
          band's own calendar, and reliability is stated only where the reviews support it.
        </p>

        <div className="bmb-w-eyebrow">
          <span className="bmb-w-dia" />
          <span>Now booking in</span>
        </div>
        <div className="bmb-w-pills">
          {cities.map((c) => (
            <span key={c} className="bmb-w-pill">{c}</span>
          ))}
        </div>

        <div className="bmb-w-foot">
          <button className="bmb-w-cta" onClick={onStart}>Find Your Band →</button>
          <div className="bmb-w-alt">
            Already have an account?{" "}
            <button className="bmb-w-login" onClick={onLogin}>Log in</button>
          </div>
        </div>
       </div>
      </div>
    </div>
  );
}
