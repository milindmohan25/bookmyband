import { createServerFn } from "@tanstack/react-start";
import { bookingInputSchema } from "./booking-schema";
import { createBooking } from "./booking.server";

export const bookBand = createServerFn({ method: "POST" })
  .validator((data) => bookingInputSchema.parse(data))
  .handler(async ({ data }) => createBooking(data));
