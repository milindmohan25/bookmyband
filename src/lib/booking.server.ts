// Public booking inserts — anonymous role, insert-only (no public select;
// a booking carries a phone number, so reading it back needs the secret
// key, server-side, not the publishable one this file uses).
//
// No Supabase project exists yet. Until SUPABASE_URL and
// SUPABASE_PUBLISHABLE_KEY are set, this logs the booking and returns
// success anyway — the same "the demo keeps working without live
// infrastructure" rule as the rest of this app.
import { createPublicServerClient } from "./supabase-public.server";
import type { BookingInput } from "./booking-schema";

export type BookingResult = { id: string; live: boolean };

export async function createBooking(input: BookingInput): Promise<BookingResult> {
  if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_PUBLISHABLE_KEY"]) {
    console.log("[booking] no Supabase configured, recording locally only:", input);
    return { id: `mock-${Date.now()}`, live: false };
  }

  const supabase = createPublicServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      band_id: input.bandId,
      event_date: input.eventDate,
      occasion: input.occasion,
      venue_city: input.venueCity,
      guest_name: input.guestName,
      guest_phone: input.guestPhone,
      guest_email: input.guestEmail || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[booking] insert failed", error);
    throw new Error("That booking could not be sent. Try again in a moment.");
  }
  return { id: data.id, live: true };
}
