/* ============================================================
   check-supabase — answers "is my Supabase project actually wired up?"

   Reads .env.local, then probes the project the same way backend.js
   does. Prints a verdict per check and never prints the key itself:
   the anon key belongs in a browser bundle, but there is no reason to
   put it in a terminal someone might screenshot.

   Run: npm run check:supabase
   ============================================================ */

import { readFileSync } from "node:fs";

const mask = (s) => (s ? s.slice(0, 6) + "…" + s.slice(-4) + ` (${s.length} chars)` : "(unset)");
const ok = (m) => console.log("  \x1b[32mPASS\x1b[0m  " + m);
const bad = (m) => console.log("  \x1b[31mFAIL\x1b[0m  " + m);
const info = (m) => console.log("        " + m);

let env = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
} catch {
  bad(".env.local not found. Copy it from .env.example and add your two values.");
  process.exit(1);
}

const URL_BASE = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const ANON = env.VITE_SUPABASE_ANON_KEY || "";

console.log("\nConfig");
if (!URL_BASE) { bad("VITE_SUPABASE_URL is empty"); } else ok("VITE_SUPABASE_URL = " + URL_BASE);
if (!ANON) { bad("VITE_SUPABASE_ANON_KEY is empty"); } else ok("VITE_SUPABASE_ANON_KEY = " + mask(ANON));
if (!URL_BASE || !ANON) {
  info("The app needs BOTH. With either missing it silently uses the in-memory store.");
  process.exit(1);
}

const call = async (path) => {
  const res = await fetch(`${URL_BASE}${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch {}
  return { status: res.status, body, text };
};

console.log("\nReachability");
let settings;
try {
  settings = await call("/auth/v1/settings");
  if (settings.status === 200) ok("auth endpoint responded");
  else if (settings.status === 401) { bad("401 from auth — the anon key is wrong or from another project"); process.exit(1); }
  else bad(`auth endpoint returned ${settings.status}`);
} catch (e) {
  bad("could not reach the project: " + e.message);
  info("A free-tier project pauses after 7 days idle — open it in the Supabase dashboard to wake it.");
  process.exit(1);
}

if (settings?.status === 200 && settings.body) {
  const ext = settings.body.external || {};
  const on = Object.keys(ext).filter((k) => ext[k]);
  info("sign-in providers enabled: " + (on.length ? on.join(", ") : "none"));
  if (!ext.email) info("email sign-in is OFF — the magic-link button will fail");
  if (!ext.google) info("Google is OFF — that button will fail (email link still works)");
}

console.log("\nSchema");
for (const table of ["profiles", "enquiries"]) {
  const r = await call(`/rest/v1/${table}?select=*&limit=1`);
  if (r.status === 200) {
    ok(`${table} exists and is readable (RLS returns ${Array.isArray(r.body) ? r.body.length : "?"} rows without a session — expected)`);
  } else if (r.status === 404 || r.body?.code === "PGRST205") {
    bad(`${table} does NOT exist — run supabase/schema.sql in the SQL Editor`);
  } else if (r.status === 401) {
    bad(`401 on ${table} — anon key rejected`);
  } else {
    bad(`${table} returned ${r.status}: ${(r.body?.message || r.text || "").slice(0, 120)}`);
  }
}

console.log("\nDone. Anything FAIL above is what to fix before the app will persist anything.\n");
