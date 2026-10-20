import type {
  ServiceType,
  Frequency,
  TimeSlot,
  CommercialFacilityType,
  CommercialSqftRange,
  CommercialFrequency,
  SchedulePreference,
} from "@/store/bookingStore";

// ── Business ─────────────────────────────────────────────────────────────────

// The number customers are told to call when a submission fails.
export const BUSINESS_PHONE = {
  display: "(315) 516-1266",
  tel: "tel:+13155161266",
} as const;

// ── Residential ──────────────────────────────────────────────────────────────

export const SERVICE_LABELS: Record<NonNullable<ServiceType>, string> = {
  standard: "Standard Clean",
  deep: "Deep Clean",
  moveinout: "Move-In / Move-Out",
};

// What each cleaning includes. The homepage cards and the residential step 1
// cards both show these, so the wording lives here once.
export const SERVICE_DESCRIPTIONS: Record<NonNullable<ServiceType>, string> = {
  standard:
    "Regular maintenance cleaning for your home. Includes dusting, vacuuming, mopping, and surface sanitizing.",
  deep: "Thorough top-to-bottom cleaning. Includes baseboards, inside appliances, and detailed scrubbing.",
  moveinout: "Complete property turnover clean. Every surface, every room, move-in ready.",
};

export const FREQUENCY_LABELS: Record<NonNullable<Frequency>, string> = {
  "one-time": "One-time",
  monthly: "Monthly",
  "bi-weekly": "Bi-weekly",
  weekly: "Weekly",
};

// Frequency choices, least to most frequent. Both flows show them in this
// order; the commercial list continues it with its extra, more frequent options.
export const FREQUENCY_OPTIONS: { id: NonNullable<Frequency>; label: string }[] = [
  { id: "one-time",  label: FREQUENCY_LABELS["one-time"] },
  { id: "monthly",   label: FREQUENCY_LABELS.monthly },
  { id: "bi-weekly", label: FREQUENCY_LABELS["bi-weekly"] },
  { id: "weekly",    label: FREQUENCY_LABELS.weekly },
];

// Single source of truth for slot windows: the customer picker, the admin
// New Booking modal, and the stored start_at/end_at must all agree.
export const TIME_SLOT_WINDOWS: Record<
  NonNullable<TimeSlot>,
  { label: string; display: string; start: string; end: string }
> = {
  morning:   { label: "Morning",   display: "8:00 AM – 12:00 PM", start: "08:00:00", end: "12:00:00" },
  afternoon: { label: "Afternoon", display: "12:00 PM – 4:00 PM", start: "12:00:00", end: "16:00:00" },
};

export const TIME_LABELS: Record<NonNullable<TimeSlot>, string> = {
  morning: `Morning (${TIME_SLOT_WINDOWS.morning.display})`,
  afternoon: `Afternoon (${TIME_SLOT_WINDOWS.afternoon.display})`,
};

// The one sentence customers see instead of a price (backlog B28): the office
// confirms the price after reviewing each booking, and nothing is charged online.
export const PRICE_NOTE =
  "We\u2019ll confirm your price after reviewing your booking \u2014 you won\u2019t be charged anything online.";

// The quote-request version of PRICE_NOTE, for the commercial review page: a
// quote request is not a booking, and the office sends the quote afterwards.
export const QUOTE_NOTE =
  "We\u2019ll send your quote after reviewing your request \u2014 you won\u2019t be charged anything online.";

// The references the server issues (`AOC-{booking_number}` in submitBooking.ts,
// `COM-{quote_number}` in submitCommercialQuote.ts). The confirmation pages
// print `?ref=` from the URL, so they accept only these shapes: anything else
// is somebody's free text on our domain.
export const BOOKING_REF_PATTERN = /^AOC-\d+$/;
export const QUOTE_REF_PATTERN = /^COM-\d+$/;

/** `value` if it looks like a booking reference the server issued, else null. */
export function parseBookingRef(value: string | null): string | null {
  return value !== null && BOOKING_REF_PATTERN.test(value) ? value : null;
}

/** `value` if it looks like a quote reference the server issued, else null. */
export function parseQuoteRef(value: string | null): string | null {
  return value !== null && QUOTE_REF_PATTERN.test(value) ? value : null;
}

// Longest accepted value for each free-text booking or quote field. Enforced on
// the server (app/actions/) and mirrored as maxLength on the inputs.
export const FIELD_MAX_LENGTHS = {
  name: 100,
  businessName: 100,
  email: 254,
  phone: 20,
  address: 200,
  city: 100,
  notes: 1000,
  // Entry instructions (door code, gate, pets), stored in booking_access.
  accessInstructions: 500,
} as const;

// Bathrooms per booking: 1 to 5 in half steps (2.5 = two full baths and a
// half-bath). Enforced in createBooking (app/actions/submitBooking.ts) and by
// the bookings_bathrooms_check constraint (numeric(2,1)); the property step's
// stepper moves by `step`.
export const BATHROOM_LIMITS = { min: 1, max: 5, step: 0.5 } as const;

// Every allowed count, for the admin New Booking select: 1, 1.5, 2 … 5.
export const BATHROOM_OPTIONS: number[] = Array.from(
  { length: (BATHROOM_LIMITS.max - BATHROOM_LIMITS.min) / BATHROOM_LIMITS.step + 1 },
  (_, i) => BATHROOM_LIMITS.min + i * BATHROOM_LIMITS.step,
);

// "1 Bathroom", "1.5 Bathrooms", "2 Bathrooms": only exactly one is singular.
export function formatBathroomCount(count: number): string {
  return `${count} ${count === 1 ? "Bathroom" : "Bathrooms"}`;
}

// Shortest admin password the reset form accepts. Supabase's own project
// setting may be stricter; its message is shown if so.
export const PASSWORD_MIN_LENGTH = 8;

export const SERVICE_AREA_ZIPS = [
  "13039", // Cicero
  "13031", // Camillus
  "13201", "13202", "13203", "13204", "13205", "13206", "13207",
  "13208", "13210", "13214", "13215", "13219", "13224", // Syracuse
  "13088", "13090", // Liverpool
  "13027", // Baldwinsville
  "13029", // Brewerton
  "13209", // Solvay
  "13104", // Manlius
  "13108", // Marcellus
];

// ── Commercial ───────────────────────────────────────────────────────────────

export const COMMERCIAL_FACILITY_TYPES: {
  id: NonNullable<CommercialFacilityType>;
  label: string;
}[] = [
  { id: "office",     label: "Office" },
  { id: "retail",     label: "Retail" },
  { id: "medical",    label: "Medical" },
  { id: "warehouse",  label: "Warehouse" },
  { id: "school",     label: "School" },
  { id: "restaurant", label: "Restaurant" },
];

export const COMMERCIAL_MAX_FLOORS = 20;

export const COMMERCIAL_SQFT_RANGES: {
  id: NonNullable<CommercialSqftRange>;
  label: string;
  shortLabel: string;
}[] = [
  { id: "<1k",   label: "< 1,000 sq ft",        shortLabel: "<1k" },
  { id: "1k-2k", label: "1,000 – 2,000 sq ft",  shortLabel: "1–2k" },
  { id: "2k-5k", label: "2,000 – 5,000 sq ft",  shortLabel: "2–5k" },
  { id: "5k+",   label: "5,000+ sq ft",          shortLabel: "5k+" },
];

export const SQFT_DISPLAY: Record<NonNullable<CommercialSqftRange>, string> = {
  "<1k":   "< 1,000 sq ft",
  "1k-2k": "1,000 – 2,000 sq ft",
  "2k-5k": "2,000 – 5,000 sq ft",
  "5k+":   "5,000+ sq ft",
};

export const COMMERCIAL_SERVICE_AREAS: { id: string; label: string }[] = [
  { id: "lobbies",     label: "Lobbies & Reception" },
  { id: "restrooms",   label: "Restrooms" },
  { id: "breakrooms",  label: "Break Rooms / Kitchens" },
  { id: "conference",  label: "Conference Rooms" },
  { id: "openoffice",  label: "Open Office / Cubicles" },
  { id: "hallways",    label: "Stairwells & Hallways" },
];

// The residential frequencies, then the two that only commercial customers
// can pick. Labels come from FREQUENCY_LABELS so the casing can't drift.
export const COMMERCIAL_FREQUENCY_LABELS: Record<NonNullable<CommercialFrequency>, string> = {
  ...FREQUENCY_LABELS,
  "2-3x": "2\u20133x / week",
  daily: "Daily",
};

export const COMMERCIAL_FREQUENCIES: {
  id: NonNullable<CommercialFrequency>;
  label: string;
}[] = [
  ...FREQUENCY_OPTIONS,
  { id: "2-3x", label: COMMERCIAL_FREQUENCY_LABELS["2-3x"] },
  { id: "daily", label: COMMERCIAL_FREQUENCY_LABELS.daily },
];

export const SCHEDULE_PREFERENCES: {
  id: NonNullable<SchedulePreference>;
  label: string;
}[] = [
  { id: "before",   label: "Before Business Hours" },
  { id: "during",   label: "During Business Hours" },
  { id: "after",    label: "After Business Hours" },
  { id: "weekends", label: "Weekends Only" },
];

export const SCHEDULE_PREFERENCE_LABELS: Record<NonNullable<SchedulePreference>, string> = {
  before:   "Before Business Hours",
  during:   "During Business Hours",
  after:    "After Business Hours",
  weekends: "Weekends Only",
};

export const FACILITY_TYPE_LABELS: Record<NonNullable<CommercialFacilityType>, string> = {
  office:     "Office",
  retail:     "Retail",
  medical:    "Medical",
  warehouse:  "Warehouse",
  school:     "School",
  restaurant: "Restaurant",
};

// Step labels used by the desktop stepper
export const COMMERCIAL_STEP_LABELS = [
  "Facility Info",
  "Service Scope",
  "Contact & Frequency",
  "Review & Request",
] as const;
