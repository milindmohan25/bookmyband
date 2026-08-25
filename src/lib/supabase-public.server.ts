// Server-side Supabase client using the publishable key — RLS applies as the
// anonymous role. Use for public read paths and the open booking insert only;
// never import into browser code.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isOpaqueApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

// New-style Supabase keys are opaque, not JWTs — sending one as a bearer token
// makes PostgREST fail with "Expected 3 parts in JWT", so strip it and rely on
// the apikey header.
function publishableFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, k) => headers.set(k, value));
    }
    if (isOpaqueApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export function createPublicServerClient(): SupabaseClient<Database> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY).");
  }
  return createClient<Database>(url, key, {
    global: { fetch: publishableFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}
