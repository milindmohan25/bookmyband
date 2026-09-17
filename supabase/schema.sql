-- BookMyBand — auth-adjacent schema.
-- Paste into Supabase Studio → SQL Editor → Run.
--
-- auth.users is managed by Supabase and is not touched here. These two
-- tables hang off it. Bands, prices and reviews deliberately stay as
-- seed JSON in the bundle: they are authored content, not user writes,
-- and putting them in Postgres would buy nothing.

-- ------------------------------------------------------------------
-- profiles: the name and number a band needs in order to reply
-- ------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null check (char_length(trim(name)) >= 2),
  phone       text check (phone ~ '^[6-9][0-9]{9}$'),
  email       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.profiles.phone is
  '10-digit Indian mobile, no +91. Collected for band callbacks, NOT used for auth.';

alter table public.profiles enable row level security;

create policy "read own profile"   on public.profiles for select using  (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update using  (auth.uid() = id)
                                                            with check (auth.uid() = id);

-- ------------------------------------------------------------------
-- enquiries: which band, which date, and the total they were quoted
-- ------------------------------------------------------------------

create table if not exists public.enquiries (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users on delete cascade,
  band_id       text not null,
  event_date    date not null,
  quoted_total  integer,
  created_at    timestamptz not null default now(),

  -- one enquiry per band per date. Makes the client's upsert idempotent,
  -- so a double tap on a slow connection cannot send twice.
  unique (user_id, band_id, event_date)
);

comment on column public.enquiries.quoted_total is
  'Rupees shown in the standardised breakdown at enquiry time. Frozen on purpose: the whole product promise is that a quote cannot quietly change afterwards.';

create index if not exists enquiries_user_created_idx
  on public.enquiries (user_id, created_at desc);

alter table public.enquiries enable row level security;

create policy "read own enquiries"   on public.enquiries for select using  (auth.uid() = user_id);
create policy "insert own enquiries" on public.enquiries for insert with check (auth.uid() = user_id);

-- Deliberately no update or delete policy. An enquiry is a record of
-- what was quoted; letting either side edit it after the fact would
-- defeat the point of storing quoted_total.

-- ------------------------------------------------------------------
-- keep updated_at honest
-- ------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
