import type { ServiceType, Frequency, TimeSlot } from "@/store/bookingStore";

export const SERVICE_LABELS: Record<NonNullable<ServiceType>, string> = {
  standard: "Standard Clean",
  deep: "Deep Clean",
  moveinout: "Move-In / Move-Out",
};

export const FREQUENCY_LABELS: Record<NonNullable<Frequency>, string> = {
  "one-time": "One-time",
  weekly: "Weekly",
  "bi-weekly": "Bi-weekly",
  monthly: "Monthly",
};

export const TIME_LABELS: Record<NonNullable<TimeSlot>, string> = {
  morning: "Morning (8am–12pm)",
  afternoon: "Afternoon (12pm–4pm)",
};

export const PRICE_MAP: Record<NonNullable<ServiceType>, string> = {
  standard: "$85",
  deep: "$149",
  moveinout: "$199",
};

export const SERVICE_AREA_ZIPS = [
  "13039", // Cicero
  "13035", // Camillus
  "13201", "13202", "13203", "13204", "13205", "13206", "13207", "13208", "13210", "13214", "13215", "13219", "13224", // Syracuse
  "13088", "13090", // Liverpool
  "13027", // Baldwinsville
  "13029", // Brewerton
  "13209", // Solvay
  "13104", // Manlius
  "13108", // Marcellus
];
