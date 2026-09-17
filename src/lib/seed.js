/* ============================================================
   Seed data and the reliability assessment over it.

   Lives apart from the UI so retrieval can read the same facts
   the screens do — one source of truth for what a band is and
   what its reviews actually evidence. `assess` returns a tier
   key rather than a colour; mapping tier -> colour is the
   caller's business.
   ============================================================ */


/* ---------- seed data ----------
   `reliability`: what a review actually evidences about showing up.
     specific  — names a concrete reliability behaviour (arrived on time, played the booked set)
     negative  — reports a reliability failure short of a dispute (late, short set)
     none      — praise or complaint with no reliability content (vibe, song list, price)
   `flag`: credible report of no-show / substitution / deposit dispute. Never averaged away.
*/

const R = (author, date, text, reliability, flag) => ({ author, date, text, reliability, flag: flag || null });

export const SEED = [
  {
    id: "sitara",
    name: "Sitara Sound Collective",
    city: "Delhi NCR",
    kind: "10-piece live band · Hindi, Punjabi, retro",
    size: 10,
    booked: ["2026-11-21", "2026-12-05", "2026-12-12"],
    price: {
      performance: 145000, extraHour: 22000, sound: "included", travelCity: 0,
      outstation: 18000, earlySetup: 8000, dj: 25000,
      advancePct: 40, refundDays: 45, contract: true,
    },
    reviews: [
      R("Ritika S.", "Feb 2026", "Arrived at 4pm for a 7pm start, sound check done well before guests came in. Played the full three hours we booked.", "specific"),
      R("Aman & Nidhi", "Jan 2026", "Same ten musicians we met at the audition turned up on the day. That mattered more to us than anything.", "specific"),
      R("Harpreet K.", "Dec 2025", "Set list was a bit safe for our crowd, we wanted more Punjabi folk. But they were exactly on schedule.", "specific"),
      R("Devansh M.", "Dec 2025", "Great energy, the brass section was the highlight of the sangeet.", "none"),
      R("Sunita R.", "Nov 2025", "Stayed 20 minutes past the end because the pheras ran late. No fuss, no extra charge.", "specific"),
      R("Kabir J.", "Nov 2025", "Sound engineer knew the venue already so setup was quick.", "specific"),
      R("Meghna T.", "Oct 2025", "Loved them. Everyone asked who we booked.", "none"),
      R("Arjun P.", "Sep 2025", "Priced higher than the others we shortlisted, worth it in the end.", "none"),
      R("Farida Q.", "Aug 2025", "Vocalist was ill and they told us four days ahead, sent a replacement recording to approve first. Handled properly.", "specific"),
    ],
  },
  {
    id: "marigold",
    name: "The Marigold Brass Co.",
    city: "Delhi NCR",
    kind: "14-piece baraat brass · processional, dhol",
    size: 14,
    booked: ["2026-12-05"],
    price: {
      performance: 98000, extraHour: 15000, sound: 20000, travelCity: 6000,
      outstation: 24000, earlySetup: null, dj: null,
      advancePct: 60, refundDays: 0, contract: false,
    },
    reviews: [
      R("Nikhil B.", "Mar 2026", "Best baraat entry on our street in years. The dhol players were unreal.", "none"),
      R("Preeti A.", "Feb 2026", "Twelve of the fourteen musicians we were shown did not turn up. They sent juniors instead and would not adjust the price. Our 60% advance was already paid and they refused to return any of it.", "negative", "substitution"),
      R("Rohan D.", "Feb 2026", "Loud, fun, exactly the vibe we wanted for the procession.", "none"),
      R("Simran V.", "Jan 2026", "Good value compared to quotes we got elsewhere.", "none"),
      R("Tarun G.", "Jan 2026", "On time and set up quickly.", "specific"),
      R("Ishita M.", "Dec 2025", "Everyone danced. Would recommend for a baraat.", "none"),
      R("Yash K.", "Dec 2025", "Really strong performers.", "none"),
      R("Anita L.", "Nov 2025", "The trumpet solo was lovely.", "none"),
      R("Vikram S.", "Nov 2025", "Turned up on schedule, played the full route.", "specific"),
      R("Neha C.", "Oct 2025", "Great for the money.", "none"),
      R("Gaurav T.", "Oct 2025", "Fantastic energy, five stars.", "none"),
      R("Pooja N.", "Sep 2025", "Booking over WhatsApp was easy, no paperwork though.", "none"),
    ],
  },
  {
    id: "anhad",
    name: "Anhad Live",
    city: "Jaipur",
    kind: "6-piece live band · Sufi, ghazal, acoustic",
    size: 6,
    booked: [],
    price: {
      performance: 72000, extraHour: 12000, sound: 14000, travelCity: 3000,
      outstation: 15000, earlySetup: 5000, dj: null,
      advancePct: 30, refundDays: 30, contract: true,
    },
    reviews: [
      R("Shalini M.", "Apr 2026", "Beautiful voices. Our mehndi felt like a private concert.", "none"),
      R("Ayaan R.", "Mar 2026", "New band but very professional with us over email.", "none"),
      R("Divya K.", "Feb 2026", "Lovely set, would book again.", "none"),
    ],
  },
  {
    id: "baaraat",
    name: "Baaraat Beats Bandwalla",
    city: "Delhi NCR",
    kind: "12-piece band + brass · Bollywood, bhangra",
    size: 12,
    booked: ["2026-11-21", "2026-11-28"],
    price: {
      performance: 112000, extraHour: 18000, sound: "included", travelCity: 4000,
      outstation: 20000, earlySetup: 6000, dj: 18000,
      advancePct: 50, refundDays: 21, contract: true,
    },
    reviews: [
      R("Manav S.", "Mar 2026", "Turned up 90 minutes late. The mandap was ready and guests were seated with nothing happening.", "negative"),
      R("Ekta B.", "Mar 2026", "On time, set up early, played right through.", "specific"),
      R("Rahul V.", "Feb 2026", "Arrived when they said they would. No issues at all.", "specific"),
      R("Jyoti P.", "Feb 2026", "They were late for the sangeet but made up for it by playing an extra half hour.", "negative"),
      R("Amitav N.", "Jan 2026", "Musicians were excellent, crowd loved it.", "none"),
      R("Sneha R.", "Jan 2026", "Two of the singers were different from the ones we auditioned. They did tell us a week before.", "negative"),
      R("Kunal M.", "Dec 2025", "Solid band, good song range.", "none"),
      R("Ridhi T.", "Dec 2025", "Punctual and easy to coordinate with our planner.", "specific"),
    ],
  },
  {
    id: "nauras",
    name: "Nauras Ensemble",
    city: "Mumbai",
    kind: "8-piece live band · jazz, retro Bollywood",
    size: 8,
    booked: ["2026-12-12"],
    price: {
      performance: 165000, extraHour: 26000, sound: "included", travelCity: 0,
      outstation: 30000, earlySetup: "included", dj: 30000,
      advancePct: 35, refundDays: 60, contract: true,
    },
    reviews: [
      R("Farhan A.", "Apr 2026", "Load-in three hours early, full sound check, started on the minute.", "specific"),
      R("Tanvi D.", "Mar 2026", "Exactly the line-up in the contract, all eight of them.", "specific"),
      R("Zoya H.", "Mar 2026", "The saxophonist alone was worth the fee.", "none"),
      R("Nitin K.", "Feb 2026", "Monsoon shifted our venue indoors two days before and they re-planned the setup without complaint or extra cost.", "specific"),
      R("Aditi J.", "Feb 2026", "Expensive, but nothing went wrong all evening.", "specific"),
      R("Rushil B.", "Jan 2026", "Very polished. Our older guests loved the retro set.", "none"),
      R("Leena M.", "Dec 2025", "Played the booked set list, finished on time, packed down quietly during dinner.", "specific"),
    ],
  },
  {
    id: "rangeen",
    name: "Rangeen Roadshow",
    city: "Chandigarh",
    kind: "9-piece band · pop, bhangra, DJ hybrid",
    size: 9,
    booked: [],
    price: {
      performance: 88000, extraHour: 14000, sound: 16000, travelCity: 5000,
      outstation: 17000, earlySetup: null, dj: 14000,
      advancePct: 50, refundDays: 15, contract: true,
    },
    reviews: [
      R("Gurpreet S.", "Apr 2026", "Dance floor was full from the first song.", "none"),
      R("Meera K.", "Mar 2026", "Song selection was perfect for a mixed-age crowd.", "none"),
      R("Vivek T.", "Mar 2026", "Good sound quality, decent lights.", "none"),
      R("Anjali R.", "Feb 2026", "Five stars, so much fun.", "none"),
      R("Sahil M.", "Feb 2026", "Slightly pricey for Chandigarh but they delivered a good show.", "none"),
      R("Kirti B.", "Jan 2026", "Loved the bhangra medley.", "none"),
      R("Deepak N.", "Jan 2026", "Nice people to deal with.", "none"),
      R("Ruchi A.", "Dec 2025", "Great atmosphere at the reception.", "none"),
      R("Ashwin P.", "Dec 2025", "Would recommend to friends.", "none"),
      R("Nisha V.", "Nov 2025", "Really enjoyed the evening.", "none"),
      R("Tejas L.", "Nov 2025", "Good band, good energy.", "none"),
    ],
  },
  {
    id: "qissa",
    name: "Qissa Qawwali Party",
    city: "Lucknow",
    kind: "7-piece qawwali party · traditional",
    size: 7,
    booked: [],
    price: {
      performance: 64000, extraHour: 10000, sound: 12000, travelCity: 2500,
      outstation: 14000, earlySetup: null, dj: null,
      advancePct: 25, refundDays: 30, contract: false,
    },
    reviews: [
      R("Sadia F.", "Mar 2026", "Moving performance, the whole family was in tears by the end.", "none"),
      R("Imran Q.", "Jan 2026", "Traditional and authentic, exactly what we hoped for.", "none"),
    ],
  },
  {
    id: "dhun",
    name: "Dhun Sangam Orchestra",
    city: "Delhi NCR",
    kind: "16-piece orchestra · film songs, live strings",
    size: 16,
    booked: ["2026-11-28"],
    price: {
      performance: 190000, extraHour: 28000, sound: 28000, travelCity: 8000,
      outstation: 35000, earlySetup: 10000, dj: 22000,
      advancePct: 55, refundDays: 0, contract: false,
    },
    reviews: [
      R("Suresh & Kamala", "Feb 2026", "They did not arrive. No call, no message. We ran the reception on a phone playlist and never saw the advance again.", "negative", "no-show"),
      R("Priya M.", "Feb 2026", "Sixteen musicians on stage is a real spectacle.", "none"),
      R("Hemant R.", "Jan 2026", "String section was gorgeous.", "none"),
      R("Bhavna S.", "Jan 2026", "Started an hour late but played beautifully once they did.", "negative"),
      R("Lalit K.", "Dec 2025", "Impressive scale for the price.", "none"),
      R("Reema J.", "Dec 2025", "Guests were amazed.", "none"),
      R("Om Prakash T.", "Nov 2025", "Very grand, good for a large venue.", "none"),
    ],
  },
];

/* ---------- reliability: pure, deterministic, no model ---------- */

export const GATE = 5; // usable reviews required before any trust claim is reachable

export function assess(band) {
  const rs = band.reviews;
  const flags = rs.filter((r) => r.flag);
  const specific = rs.filter((r) => r.reliability === "specific");
  const negative = rs.filter((r) => r.reliability === "negative");
  const onTopic = specific.length + negative.length;

  const base = { total: rs.length, onTopic, specific, negative, flags, gate: GATE };

  // Flagged is checked first and is never averaged against volume.
  if (flags.length) {
    const kinds = [...new Set(flags.map((f) => f.flag))];
    return {
      ...base, tier: "flagged", label: "Flagged",
      headline: `${flags.length} report${flags.length > 1 ? "s" : ""} of ${kinds.join(" and ")}`,
      body: `Shown regardless of the ${rs.length - flags.length} other reviews. A single credible report of this kind is not cancelled out by positive ones, because you cannot get the day back.`,
    };
  }
  if (onTopic < GATE) {
    return {
      ...base, tier: "limited", label: "Limited info",
      headline: `${onTopic} of ${GATE} reviews needed`,
      body: onTopic === 0
        ? `${rs.length} review${rs.length === 1 ? "" : "s"}, none of which say anything about whether the band turned up or played what was booked. There is no trust claim to make here.`
        : `Only ${onTopic} of ${rs.length} reviews mention reliability. That is not enough to tell you anything, and a score here would be a guess dressed as a fact.`,
    };
  }
  if (negative.length) {
    return {
      ...base, tier: "mixed", label: "Mixed",
      headline: `${specific.length} clean, ${negative.length} with problems`,
      body: "Reviewers disagree on reliability. Both sides are below — read them rather than trusting an average of them.",
    };
  }
  return {
    ...base, tier: "consistent", label: "Consistent",
    headline: `${specific.length} reviews, no reliability complaints`,
    body: "Multiple reviewers name specific things that went right: arriving early, the booked musicians appearing, playing the full set.",
  };
}
