import React, { useState, useEffect, useRef } from "react";

const GOLD = "#F3C862";
const GOLD_DEEP = "#C08A24";
const CREAM = "#FFF2D4";
const MARIGOLD = "#FF9E1B";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const Easing = {
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

const makeAnimate = (ease) => (o) => (T) => {
  const { start, end, from = 0, to = 1 } = o;
  if (end <= start) return T >= start ? to : from;
  const p = clamp((T - start) / (end - start), 0, 1);
  return from + (to - from) * ease(p);
};

const MOTION = {
  enter: makeAnimate(Easing.easeOutCubic),
  draw: makeAnimate(Easing.easeInOutQuart),
  pop: makeAnimate(Easing.easeOutBack),
};

// scene timeline -> cue table (mirrors the authored OM_SCENES)
const SCENES = [
  { name: "Spark", dur: 0.9 },
  { name: "Mandap", dur: 1.4 },
  { name: "Garland", dur: 1.0 },
  { name: "Fanfare", dur: 1.2 },
  { name: "Wordmark", dur: 1.5 },
  { name: "Settle", dur: 1.3 },
  { name: "Reset", dur: 0.7 },
];
const CUES = {};
let acc = 0;
for (const s of SCENES) { CUES[s.name] = acc; acc += s.dur; }
const AUTHORED_TOTAL = acc;

// geometry helpers
const ARCH = "M88 214 C88 152 120 120 148 114 C170 110 180 96 200 60 C220 96 230 110 252 114 C280 120 312 152 312 214";
const quad = (t, p0, p1, p2) => ({
  x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
  y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
});
const GARLAND = (() => {
  const out = [];
  for (let i = 0; i <= 14; i++) {
    const p = quad(i / 14, { x: 100, y: 226 }, { x: 200, y: 306 }, { x: 300, y: 226 });
    out.push({ ...p, r: i % 2 ? 5.2 : 7.4, c: i % 2 ? GOLD : MARIGOLD, i });
  }
  return out;
})();
const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const a = (-96 + i * 6.4) * (Math.PI / 180);
  const d = 46 + ((i * 37) % 90);
  return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: 1.6 + ((i * 13) % 5) * 0.7, delay: (i % 6) * 0.055 };
});

function Mark({ T, C, w }) {
  const arch = MOTION.draw({ start: C.Mandap + 0.05, end: C.Mandap + 1.05 })(T);
  const archIn = MOTION.draw({ start: C.Mandap + 0.35, end: C.Mandap + 1.25 })(T);
  const pillar = MOTION.pop({ start: C.Mandap + 0.5, end: C.Mandap + 1.3 })(T);
  const plinth = MOTION.enter({ start: C.Garland - 0.1, end: C.Garland + 0.45 })(T);
  const finial = MOTION.pop({ start: C.Spark + 0.25, end: C.Spark + 0.95 })(T);
  const seed = MOTION.enter({ start: C.Spark + 0.02, end: C.Spark + 0.5 })(T);
  const glow = MOTION.enter({ from: 0.15, to: 1, start: C.Spark, end: C.Fanfare + 0.4 })(T);
  const bloom = MOTION.enter({ from: 0, to: 1, start: C.Spark, end: C.Spark + 0.7 })(T);

  const tIn = MOTION.pop({ start: C.Fanfare - 0.12, end: C.Fanfare + 0.7 })(T);
  const tRot = -30 - (1 - tIn) * 42;
  const tX = 118 - (1 - tIn) * 130;
  const tY = 300 + (1 - tIn) * 120;
  const blast = clamp((T - (C.Fanfare + 0.35)) / 0.75, 0, 1);
  const ringPulse = (k) => {
    const ph = ((T - (C.Fanfare + 0.4)) * 1.35 + k * 0.34) % 1;
    if (T < C.Fanfare + 0.4) return { s: 0, o: 0 };
    return { s: 0.55 + ph * 1.1, o: (1 - ph) * 0.85 * (T > C.Settle + 0.7 ? 0.55 : 1) };
  };
  const out = 1 - MOTION.enter({ start: C.Reset + 0.05, end: C.Reset + 0.5 })(T);

  return (
    <svg width={w} height={w * (420 / 400)} viewBox="0 0 400 420" style={{ overflow: "visible", opacity: out }}>
      <defs>
        <linearGradient id="brass" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#FFE9AE" />
          <stop offset="0.45" stopColor={GOLD} />
          <stop offset="1" stopColor="#A9701A" />
        </linearGradient>
        <radialGradient id="bloom" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE7A8" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#FF9E1B" stopOpacity="0.12" />
          <stop offset="1" stopColor="#FF9E1B" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="200" cy="200" r={150 + bloom * 90} fill="url(#bloom)" opacity={glow * 0.9} />

      <g opacity={plinth} transform={`translate(0 ${(1 - plinth) * 26})`}>
        <rect x="52" y="352" width="296" height="15" rx="4" fill={GOLD} />
        <rect x="38" y="372" width="324" height="9" rx="4" fill={GOLD_DEEP} />
      </g>

      {[{ x: 74 }, { x: 296 }].map((p, i) => (
        <g key={i} transform={`translate(0 356) scale(1 ${pillar}) translate(0 -356)`} opacity={clamp(pillar * 2, 0, 1)}>
          <rect x={p.x + 4} y="214" width="22" height="140" fill={GOLD} />
          <rect x={p.x - 4} y="200" width="38" height="15" rx="3" fill={CREAM} />
          <rect x={p.x - 6} y="340" width="42" height="14" rx="3" fill={CREAM} />
          <circle cx={p.x + 15} cy="268" r="5" fill="#8E0E12" />
        </g>
      ))}

      <path d={ARCH} pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - arch} fill="none"
        stroke={GOLD} strokeWidth="10" strokeLinecap="round" />
      <g transform="translate(200 214) scale(0.84) translate(-200 -214)">
        <path d={ARCH} pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - archIn} fill="none"
          stroke={CREAM} strokeWidth="5" strokeLinecap="round" opacity="0.85" />
      </g>

      <g transform={`translate(200 ${44 - (1 - finial) * 6}) scale(${0.5 + finial * 0.5})`}>
        <path d="M0 -34 L7 -20 L0 -6 L-7 -20 Z" fill={CREAM} opacity={finial} />
        <rect x="-2.5" y="-20" width="5" height="20" fill={GOLD} opacity={finial} />
        <circle cx="0" cy="6" r={9} fill={GOLD} />
        <circle cx="0" cy="6" r={4 + seed * 2} fill="#FFF7E2" opacity={0.55 + seed * 0.45} />
      </g>

      {GARLAND.map((d) => {
        const p = MOTION.pop({ start: C.Garland + d.i * 0.028, end: C.Garland + 0.48 + d.i * 0.028 })(T);
        return <circle key={d.i} cx={d.x} cy={d.y - (1 - p) * 34} r={d.r * clamp(p, 0, 1.15)} fill={d.c} opacity={clamp(p * 1.4, 0, 1)} />;
      })}

      <g transform={`translate(${tX} ${tY}) rotate(${tRot}) scale(0.82)`} opacity={clamp(tIn * 1.6, 0, 1)}>
        {[0, 1, 2].map((k) => {
          const r = ringPulse(k);
          return (
            <path key={k} d="M0 -34 Q22 0 0 34" fill="none" stroke={CREAM} strokeWidth={4 / (r.s || 1)}
              strokeLinecap="round" opacity={r.o} transform={`translate(206 0) scale(${r.s})`} />
          );
        })}
        <rect x="-14" y="-7" width="16" height="14" rx="6" fill={CREAM} />
        <rect x="0" y="-6" width="128" height="12" rx="3" fill="url(#brass)" />
        <rect x="0" y="-6" width="128" height="3.5" rx="2" fill="#FFEFC0" opacity="0.75" />
        {[48, 70, 92].map((x) => (
          <g key={x}>
            <rect x={x} y="-26" width="11" height="22" rx="3" fill="url(#brass)" />
            <rect x={x - 2} y="-31" width="15" height="6" rx="3" fill={CREAM} />
          </g>
        ))}
        <path d="M126 -7 C150 -11 162 -26 182 -42 L182 42 C162 26 150 11 126 7 Z" fill="url(#brass)" />
        <ellipse cx="182" cy="0" rx="7" ry="42" fill={CREAM} />
        <ellipse cx="182" cy="0" rx="3" ry="34" fill="#8E0E12" opacity="0.35" />
        {SPARKS.map((s, i) => {
          const p = clamp((blast - s.delay) / 0.6, 0, 1);
          return <circle key={i} cx={196 + s.dx * p} cy={s.dy * p} r={s.r * (1 - p * 0.7)} fill={i % 3 ? GOLD : CREAM} opacity={(1 - p) * clamp(blast * 3, 0, 1)} />;
        })}
      </g>
    </svg>
  );
}

function Wordmark({ T, C, scale, tagline }) {
  const letters = "BookMyBand".split("");
  const rule = MOTION.enter({ start: C.Wordmark + 0.55, end: C.Wordmark + 1.15 })(T);
  const tag = MOTION.enter({ start: C.Settle - 0.15, end: C.Settle + 0.55 })(T);
  const out = 1 - MOTION.enter({ start: C.Reset, end: C.Reset + 0.45 })(T);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 * scale, opacity: out }}>
      <div style={{ display: "flex", fontFamily: "Georgia, serif", fontSize: 62 * scale, lineHeight: 1, letterSpacing: "0.005em" }}>
        {letters.map((ch, i) => {
          const p = MOTION.enter({ start: C.Wordmark + 0.06 + i * 0.055, end: C.Wordmark + 0.62 + i * 0.055 })(T);
          const isMy = i === 4 || i === 5;
          return (
            <span key={i} style={{
              opacity: p, transform: `translateY(${(1 - p) * 34}px)`,
              color: isMy ? GOLD : CREAM, textShadow: "0 6px 24px rgba(0,0,0,0.35)",
            }}>{ch}</span>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 * scale, opacity: rule }}>
        <div style={{ width: 10 * scale, height: 10 * scale, background: GOLD, transform: "rotate(45deg)" }} />
        <div style={{ width: 140 * scale * rule, height: 2, background: `linear-gradient(90deg, ${GOLD_DEEP}, ${GOLD}, ${GOLD_DEEP})` }} />
        <div style={{ width: 10 * scale, height: 10 * scale, background: GOLD, transform: "rotate(45deg)" }} />
      </div>
      {tagline ? (
        <div style={{
          fontFamily: "sans-serif", fontSize: 15 * scale, letterSpacing: "0.3em", textTransform: "uppercase",
          color: GOLD, opacity: tag * 0.82, transform: `translateY(${(1 - tag) * 16}px)`, whiteSpace: "nowrap",
        }}>Live bands, booked in minutes</div>
      ) : null}
    </div>
  );
}

function Piece({ T, C, w: W, h: H, bg, tagline }) {
  const tall = H > W * 1.2;
  const scale = tall ? 1 : 0.84;
  const markW = (tall ? 190 : 150) * (W / 400);

  const cam = MOTION.enter({ from: 1.07, to: 1, start: 0, end: AUTHORED_TOTAL * 0.7 })(T);
  const punch = 1 + 0.035 * (1 - MOTION.pop({ start: C.Fanfare + 0.2, end: C.Fanfare + 1.0 })(T));
  const lift = MOTION.enter({ from: 0, to: tall ? -24 : -14, start: C.Wordmark - 0.2, end: C.Wordmark + 0.9 })(T);
  const breathe = 1 + Math.sin(T * 1.05) * 0.006;
  const spin = T * 3.2;
  const halo = MOTION.enter({ from: 0, to: 1, start: C.Mandap, end: C.Wordmark })(T) *
    (1 - MOTION.enter({ start: C.Reset, end: C.Reset + 0.45 })(T));

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: bg }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(58% 42% at 50% 42%, rgba(255,168,60,0.22), rgba(0,0,0,0) 70%)" }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: halo * 0.5 }}>
        <g transform={`translate(${W / 2} ${H * (tall ? 0.42 : 0.44)}) rotate(${spin})`}>
          <circle r={W * 0.44} fill="none" stroke={GOLD} strokeWidth="1.5" strokeDasharray="2 26" opacity="0.9" />
          <circle r={W * 0.5} fill="none" stroke={CREAM} strokeWidth="1" strokeDasharray="1 40" opacity="0.6" />
        </g>
        <g transform={`translate(${W / 2} ${H * (tall ? 0.42 : 0.44)}) rotate(${-spin * 0.6})`}>
          <circle r={W * 0.37} fill="none" stroke={GOLD} strokeWidth="1" strokeDasharray="8 22" opacity="0.5" />
        </g>
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: (tall ? 34 : 22) * scale,
        transform: `scale(${cam * punch * breathe}) translateY(${lift}px)`,
      }}>
        <Mark T={T} C={C} w={markW} />
        <Wordmark T={T} C={C} scale={scale} tagline={tagline} />
      </div>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(70% 55% at 50% 48%, rgba(0,0,0,0) 45%, rgba(40,0,2,0.55) 100%)" }} />
    </div>
  );
}

const FIELDS = {
  "#A61217": "radial-gradient(75% 55% at 50% 40%, #A61217 0%, #7C0B10 45%, #48060A 100%)",
  "#8A1020": "radial-gradient(75% 55% at 50% 40%, #8A1020 0%, #5E0A16 48%, #33050C 100%)",
  "#C21D18": "radial-gradient(75% 55% at 50% 40%, #C21D18 0%, #8E1010 45%, #4E0708 100%)",
};

export default function BootLogo() {
  const [format, setFormat] = useState("splash");
  const [bgKey, setBgKey] = useState("#A61217");
  const [tagline, setTagline] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [T, setT] = useState(0);
  const [dims, setDims] = useState({ w: 400, h: 711 });
  const wrapRef = useRef(null);

  const square = format === "square";

  useEffect(() => {
    if (!wrapRef.current || typeof ResizeObserver === "undefined") return;
    const el = wrapRef.current;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setDims({ w: width, h: square ? width : width * (16 / 9) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [square]);

  useEffect(() => {
    if (!playing) return;
    let raf, last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      setT((prev) => (prev + dt) % AUTHORED_TOTAL);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <div style={{ width: "100%", padding: "1rem 0", display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        ref={wrapRef}
        onClick={() => setPlaying((p) => !p)}
        style={{
          width: "100%", maxWidth: 380, margin: "0 auto",
          aspectRatio: square ? "1 / 1" : "9 / 16",
          position: "relative", overflow: "hidden", borderRadius: 16, cursor: "pointer",
        }}
        title={playing ? "Click to pause" : "Click to play"}
      >
        <Piece T={T} C={CUES} w={dims.w} h={dims.h} bg={FIELDS[bgKey] || FIELDS["#A61217"]} tagline={tagline} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", alignItems: "center", fontFamily: "sans-serif", fontSize: 13, color: "var(--text-secondary, #666)" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["splash", "square"].map((f) => (
            <button key={f} onClick={() => setFormat(f)}
              style={{
                padding: "4px 10px", borderRadius: 999, border: "1px solid #ccc",
                background: format === f ? "#333" : "transparent", color: format === f ? "#fff" : "#333",
                fontSize: 12, cursor: "pointer",
              }}>{f}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.keys(FIELDS).map((c) => (
            <button key={c} onClick={() => setBgKey(c)}
              style={{
                width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer",
                border: bgKey === c ? "2px solid #333" : "1px solid #ccc",
              }} />
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={tagline} onChange={(e) => setTagline(e.target.checked)} />
          tagline
        </label>
        <span style={{ fontSize: 12 }}>{playing ? "click stage to pause" : "paused — click to resume"}</span>
      </div>
    </div>
  );
}
