/* ============================================================
   Hand-written to match supabase/schema.sql, in place of the file
   `supabase gen types typescript` would produce once a real project
   exists. Regenerate from the live project once one is created —
   this is a stand-in, not a source of truth.
   ============================================================ */

export type ReviewRow = {
  author: string;
  date: string;
  text: string;
  reliability: "specific" | "negative" | "none";
  flag: string | null;
};

export type PriceBreakdown = {
  performance: number;
  extraHour: number;
  sound: number | "included" | null;
  travelCity: number | null;
  outstation: number | null;
  earlySetup: number | "included" | null;
  dj: number | null;
  advancePct: number;
  refundDays: number;
  contract: boolean;
};

export type Database = {
  public: {
    Tables: {
      bands: {
        Row: {
          id: string;
          slug: string;
          name: string;
          city: string;
          genres: string[];
          occasions: string[];
          description: string;
          notable_performances: string | null;
          members_count: number;
          rating: number;
          featured: boolean;
          price_per_event: number;
          price_breakdown: PriceBreakdown;
          booked: string[];
          reviews: ReviewRow[];
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["bands"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["bands"]["Row"]>;
      };
      bookings: {
        Row: {
          id: string;
          band_id: string;
          event_date: string;
          occasion: string;
          venue_city: string;
          guest_name: string;
          guest_phone: string;
          guest_email: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          band_id: string;
          event_date: string;
          occasion: string;
          venue_city: string;
          guest_name: string;
          guest_phone: string;
          guest_email?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
      };
    };
  };
};
