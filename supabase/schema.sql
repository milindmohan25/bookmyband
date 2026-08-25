-- BookMyBand — catalogue and booking schema.
-- Paste into Supabase Studio → SQL Editor → Run, then run seed.sql.
--
-- Superseded from an earlier auth-oriented schema (profiles + enquiries,
-- gated behind Google OAuth / a passwordless email link — see git history
-- if that flow is ever wanted back). This version treats a booking as a
-- guest submission: the required contact details travel in the booking
-- row itself, validated by booking-schema.ts, so nobody has to create an
-- account to ask a band to hold a date.

-- ------------------------------------------------------------------
-- bands: the catalogue. Public, read-only from the client's point of
-- view — there is no user-writable path to this table.
-- ------------------------------------------------------------------

create extension if not exists pgcrypto;

create table if not exists public.bands (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null,
  name                  text not null,
  city                  text not null,
  genres                text[] not null default '{}',
  occasions             text[] not null default '{}',
  description           text not null default '',
  notable_performances  text,
  members_count         integer not null default 0,
  rating                numeric(2,1) not null default 0,
  featured              boolean not null default false,

  -- price_per_event is the flat number a listing card sorts/filters
  -- on; price_breakdown is the full seven-line-item quote (the
  -- "standardised price breakdown" feature) plus advance/refund/
  -- contract terms — same shape as the old SEED price object.
  price_per_event       integer not null,
  price_breakdown       jsonb not null default '{}'::jsonb,

  -- booked: ISO dates already spoken for, checked against the date a
  -- visitor searches. reviews: hand-tagged {author,date,text,
  -- reliability,flag}[] — the Reliability Signal is computed from
  -- these at request time, deterministically, not stored as a score.
  booked                date[] not null default '{}',
  reviews               jsonb not null default '[]'::jsonb,

  created_at            timestamptz not null default now()
);

alter table public.bands enable row level security;

create policy "public can read bands" on public.bands
  for select using (true);

-- Deliberately no insert/update/delete policy for the anonymous role.
-- The catalogue is authored content, not user writes; changing it
-- means running SQL with the secret key, not a client request.

-- ------------------------------------------------------------------
-- bookings: a guest's request to hold a date. Insert-only from the
-- client's point of view — a booking carries a phone number, so
-- reading it back requires the secret key from an admin context,
-- never the publishable key the app ships with.
-- ------------------------------------------------------------------

create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  band_id      uuid not null references public.bands(id),
  event_date   date not null,
  occasion     text not null,
  venue_city   text not null,
  guest_name   text not null,
  guest_phone  text not null check (guest_phone ~ '^[6-9][0-9]{9}$'),
  guest_email  text,
  notes        text,
  created_at   timestamptz not null default now()
);

comment on column public.bookings.guest_phone is
  '10-digit Indian mobile, no +91. Collected so the band can call back — not a credential, and there is no login here at all.';

create index if not exists bookings_band_created_idx
  on public.bookings (band_id, created_at desc);

alter table public.bookings enable row level security;

create policy "public can send a booking" on public.bookings
  for insert with check (true);

-- No select/update/delete policy for the anonymous role. Reading the
-- booking list back (to actually run the business) is a job for the
-- secret key from a trusted context, not something the published
-- publishable key should ever be able to do.
