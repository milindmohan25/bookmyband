import { z } from "zod";

// Shared between the booking server function (authoritative validation) and
// the booking dialog (instant client-side feedback).
export const bookingInputSchema = z.object({
  bandId: z.string().uuid("Pick a band first"),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose your event date"),
  occasion: z.string().trim().min(2, "Pick the occasion").max(60),
  venueCity: z.string().trim().min(2, "Tell us the venue city").max(80),
  guestName: z.string().trim().min(2, "Your name, please").max(80),
  guestPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a 10-digit Indian mobile number"),
  guestEmail: z
    .string()
    .trim()
    .email("That email doesn't look right")
    .max(120)
    .or(z.literal("")),
  notes: z.string().trim().max(500).or(z.literal("")),
});

export type BookingInput = z.infer<typeof bookingInputSchema>;
