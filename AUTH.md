# Auth setup

Supabase free tier. Google OAuth for identity, phone number as a profile field.

## Why not phone OTP

Phone OTP was the obvious choice for an Indian consumer product and it is the one
this project deliberately does not use.

Supabase phone login requires a separate SMS provider — Twilio, MessageBird or
Vonage. Twilio Verify is roughly **$0.10 per successful verification**, against
about **₹0.25** through a local Indian provider like MSG91. On top of the cost,
India's TRAI **DLT regulations** require registering as an *enterprise* with a
telecom operator (Jio, Airtel, Vi or BSNL) and submitting company documents
before any SMS can be delivered. That is not completable as an individual
building a portfolio project, and it is not worth a recurring per-login bill for
a product each customer uses roughly once.

Google OAuth is included on the Supabase free plan, costs nothing per login, and
takes one tap. The number is still collected — bands need something to ring — but
it lives in `profiles.phone` as data, not as a credential.

## Steps

1. **Create the project.** supabase.com → new project. Free plan. Pick the
   Mumbai (`ap-south-1`) region for latency.
2. **Run the schema.** Studio → SQL Editor → paste `supabase/schema.sql` → Run.
   Creates `profiles` and `enquiries` with row-level security on both.
3. **Enable Google.** Authentication → Providers → Google. You will need an OAuth
   client from the Google Cloud console; set the authorised redirect URI to the
   value Supabase shows you on that page.
4. **Set the site URL.** Authentication → URL Configuration. Add your deployed
   origin and `http://localhost:5173` to redirect allow-list, or the sign-in
   round trip will bounce.
5. **Copy the keys.** Project Settings → API. Put the URL and the **anon** key in
   `.env.local` per `.env.example`.

The anon key belongs in the client bundle — that is what it is for. RLS is the
actual protection: every policy in the schema is scoped to `auth.uid()`, so a
signed-in user can read their own rows and nobody else's, no matter what the
client asks for. The `service_role` key must never appear in frontend code.

## Two free-tier gotchas

**Projects pause after 7 days of no requests.** This is the one that will bite a
portfolio project — a recruiter opening the link a month after you sent it gets a
dead backend. Either ping the project on a schedule (a weekly GitHub Action
hitting any endpoint is enough) or accept it and note in the README that the demo
falls back to the in-memory store.

**Built-in email is rate limited hard.** The email-link path uses Supabase's
shared SMTP, which allows only a couple of sends per hour on the free plan. Fine
for you testing; not fine for real users. Wire up custom SMTP (Resend's free tier
covers this) before anyone else touches it. Google OAuth has no such limit, which
is the other reason it is the primary path.

## Running without keys

Leave the env vars unset and `backend.js` uses an in-memory store with the same
shape as the SQL tables. Both sign-in buttons complete immediately. Useful for
local UI work and for keeping the deployed demo alive if the project pauses.

`IS_LIVE` tells you which mode you are in, and the sign-in sheet says so on
screen rather than pretending.
