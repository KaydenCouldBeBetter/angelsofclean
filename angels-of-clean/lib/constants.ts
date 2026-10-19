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

// The number customers are told to call when a submission fails. Placeholder
// until the real line exists: backlog B32 replaces it (and the other 555
// numbers) with the business's actual phone.
export const BUSINESS_PHONE = {
  display: "(315) 555-0100",
  tel: "tel:+13155550100",
} as const;

// ── Residential ──────────────────────────────────────────────────────────────

export const SERVICE_LABELS: Record<NonNullable<ServiceType>, string> = {
  standard: "Standard Clean",
  deep: "Deep Clean",
  moveinout: "Move-In / Move-Out",
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

export const PRICE_MAP: Record<NonNullable<ServiceType>, string> = {
  standard: "$85",
  deep: "$149",
  moveinout: "$199",
};

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

export const COMMERCIAL_FREQUENCIES: {
  id: NonNullable<CommercialFrequency>;
  label: string;
}[] = [
  { id: "one-time",  label: "One-Time" },
  { id: "monthly",   label: "Monthly" },
  { id: "bi-weekly", label: "Bi-Weekly" },
  { id: "weekly",    label: "Weekly" },
  { id: "2-3x",      label: "2–3x / Week" },
  { id: "daily",     label: "Daily" },
];

export const COMMERCIAL_FREQUENCY_LABELS: Record<NonNullable<CommercialFrequency>, string> = {
  "one-time": "One-Time",
  monthly:    "Monthly",
  "bi-weekly":"Bi-Weekly",
  weekly:     "Weekly",
  "2-3x":     "2–3x / Week",
  daily:      "Daily",
};

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
