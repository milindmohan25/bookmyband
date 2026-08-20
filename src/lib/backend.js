/* ============================================================
   backend.js — one module, two implementations.

   If VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present,
   every call below hits a real Supabase project over plain fetch.
   If they are not, it falls back to an in-memory store so the demo
   still runs with no backend at all.

   No npm dependency. @supabase/supabase-js is a convenience wrapper
   over these same HTTP endpoints, and skipping it keeps this file
   runnable anywhere a browser is, including a sandboxed preview.
   ============================================================ */

const URL_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) || "";
const ANON = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) || "";

export const IS_LIVE = Boolean(URL_BASE && ANON);

const TOKEN_KEY = "bmb.session";

/* ---------------- session storage ----------------
   sessionStorage over localStorage: a shared laptop at a wedding
   planner's office should not keep someone signed in indefinitely.
   Wrapped in try/catch because sandboxed frames throw on access. */

let memToken = null;

const readToken = () => {
  if (memToken) return memToken;
  try { return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null"); } catch { return null; }
};
const writeToken = (t) => {
  memToken = t;
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch { /* sandboxed: memory only */ }
};

/* ---------------- http ---------------- */

async function api(path, { method = "GET", body, auth = true, prefer } = {}) {
  const token = readToken();
  const headers = { apikey: ANON, "Content-Type": "application/json" };
  if (auth && token?.access_token) headers.Authorization = `Bearer ${token.access_token}`;
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${URL_BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.msg || data?.message || data?.error_description || `Request failed (${res.status})`);
  return data;
}

/* ---------------- mock store ----------------
   Mirrors the SQL schema so swapping in real keys changes nothing
   above this file. */

const mock = {
  session: null,
  profiles: {
    "seed-user-1": { id: "seed-user-1", name: "Aarav Mehta", phone: "9811012345", email: "aarav@example.in" },
  },
  enquiries: [
    { id: 1, user_id: "seed-user-1", band_id: "nauras", event_date: "2026-11-21", created_at: "2026-08-04T10:00:00Z" },
  ],
  nextId: 2,
};

const wait = (ms = 260) => new Promise((r) => setTimeout(r, ms));

/* ---------------- public API ---------------- */

export async function getSession() {
  if (!IS_LIVE) return mock.session;
  const token = readToken();
  if (!token?.access_token) return null;
  try {
    const user = await api("/auth/v1/user");
    return { userId: user.id, email: user.email };
  } catch {
    writeToken(null);
    return null;
  }
}

/* Google OAuth. Supabase handles the round trip and returns tokens in
   the URL fragment, which consumeRedirect() below picks up on load. */
export function signInWithGoogle() {
  if (!IS_LIVE) {
    mock.session = { userId: "mock-google-user", email: "you@example.com" };
    return Promise.resolve({ mocked: true });
  }
  const redirect = encodeURIComponent(window.location.origin + window.location.pathname);
  window.location.assign(`${URL_BASE}/auth/v1/authorize?provider=google&redirect_to=${redirect}`);
  return new Promise(() => {}); // navigating away
}

/* Passwordless email. Free, but Supabase's built-in SMTP is rate
   limited hard — wire up custom SMTP before anyone else uses this. */
export async function sendEmailLink(email) {
  if (!IS_LIVE) { await wait(); return { mocked: true }; }
  const redirect = window.location.origin + window.location.pathname;
  await api("/auth/v1/otp", {
    method: "POST", auth: false,
    body: { email, create_user: true, options: { email_redirect_to: redirect } },
  });
  return { sent: true };
}

/* Call once on app load: turns #access_token=... into a stored session. */
export async function consumeRedirect() {
  if (!IS_LIVE || typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash) return null;
  const p = new URLSearchParams(hash);
  const access_token = p.get("access_token");
  if (!access_token) return null;
  writeToken({ access_token, refresh_token: p.get("refresh_token") });
  history.replaceState(null, "", window.location.pathname + window.location.search);
  return getSession();
}

export async function signOut() {
  if (!IS_LIVE) { mock.session = null; return; }
  try { await api("/auth/v1/logout", { method: "POST" }); } catch { /* token already dead */ }
  writeToken(null);
}

export async function getProfile(userId) {
  if (!IS_LIVE) { await wait(120); return mock.profiles[userId] || null; }
  const rows = await api(`/rest/v1/profiles?id=eq.${userId}&select=*`);
  return rows?.[0] || null;
}

export async function saveProfile(userId, { name, phone, email }) {
  if (!IS_LIVE) {
    await wait();
    mock.profiles[userId] = { id: userId, name, phone, email };
    return mock.profiles[userId];
  }
  const rows = await api("/rest/v1/profiles", {
    method: "POST",
    prefer: "return=representation,resolution=merge-duplicates",
    body: { id: userId, name, phone, email },
  });
  return rows?.[0];
}

export async function listEnquiries(userId) {
  if (!IS_LIVE) {
    await wait(120);
    return mock.enquiries.filter((e) => e.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return api(`/rest/v1/enquiries?user_id=eq.${userId}&select=*&order=created_at.desc`);
}

export async function createEnquiry(userId, { bandId, date, quotedTotal }) {
  const row = { user_id: userId, band_id: bandId, event_date: date, quoted_total: quotedTotal };
  if (!IS_LIVE) {
    await wait();
    const e = { id: mock.nextId++, ...row, created_at: new Date().toISOString() };
    mock.enquiries.push(e);
    return e;
  }
  const rows = await api("/rest/v1/enquiries", {
    method: "POST",
    prefer: "return=representation,resolution=merge-duplicates",
    body: row,
  });
  return rows?.[0];
}
