// Public band catalogue reads — anonymous role, RLS-respecting.
//
// Extended beyond the original shape with the fields the rest of the
// app actually needs: `reviews` and `booked` (the Reliability Signal
// and the date-availability check both read from these), and `price`
// (the seven-line-item breakdown, aliased from price_breakdown so the
// UI code did not need to change). `id` is aliased from `slug` — the
// UI, retrieval and the concierge all use this as the stable, human-
// legible identifier; the real uuid primary key travels separately as
// `dbId`, for the one place that needs it: submitting a booking.
//
// No Supabase project exists yet for this app. Until SUPABASE_URL and
// SUPABASE_PUBLISHABLE_KEY are set, this reads the same hand-authored
// seed set the rest of the demo already depended on — same fallback
// philosophy as backend.js and ask.js: a portfolio link should not go
// dark for missing infrastructure.
import { createPublicServerClient } from "./supabase-public.server";
import { SEED } from "./seed.js";
import type { PriceBreakdown, ReviewRow } from "@/integrations/supabase/types";

export type PublicBand = {
  id: string;
  dbId: string;
  name: string;
  city: string;
  // `kind` and `size` are what the existing UI and retrieval code
  // (written against the seed set) already key off; `genres` /
  // `occasions` / `members_count` / `description` are the richer
  // shape the new schema stores them as. Both are carried so neither
  // side needed to change.
  kind: string;
  size: number;
  genres: string[];
  occasions: string[];
  price_per_event: number;
  price: PriceBreakdown;
  rating: number;
  members_count: number;
  description: string;
  notable_performances: string | null;
  featured: boolean;
  booked: string[];
  reviews: ReviewRow[];
};

function fromSeed(): PublicBand[] {
  return SEED.map((b) => ({
    id: b.id,
    dbId: b.dbId,
    name: b.name,
    city: b.city,
    kind: b.kind,
    size: b.size,
    genres: [],
    occasions: [],
    price_per_event: b.price.performance,
    price: b.price,
    rating: 0,
    members_count: b.size,
    description: b.kind,
    notable_performances: null,
    featured: false,
    booked: b.booked,
    reviews: b.reviews,
  }));
}

function withDisplayFields(row: any): PublicBand {
  const genres: string[] = row.genres ?? [];
  const kind = genres.length
    ? `${row.members_count}-piece · ${genres.join(", ")}`
    : row.description;
  return { ...row, kind, size: row.members_count };
}

export async function listBands(): Promise<{ bands: PublicBand[]; live: boolean }> {
  if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_PUBLISHABLE_KEY"]) {
    return { bands: fromSeed(), live: false };
  }

  const supabase = createPublicServerClient();
  const { data, error } = await supabase
    .from("bands")
    .select(
      "id:slug, dbId:id, name, city, genres, occasions, price_per_event, price:price_breakdown, rating, members_count, description, notable_performances, featured, booked, reviews",
    )
    .order("featured", { ascending: false })
    .order("rating", { ascending: false });

  if (error) {
    console.error("[catalog] failed to list bands, falling back to seed data", error);
    return { bands: fromSeed(), live: false };
  }
  return { bands: (data ?? []).map(withDisplayFields), live: true };
}
