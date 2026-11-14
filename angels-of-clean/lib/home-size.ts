// How big a home is, as the customer or the office describes it. It is the size
// the crew limit (next step of admin Settings phase 2b) counts: a small home
// takes about half a crew's slot, anything else a whole slot. The database
// repeats the allowed values as a CHECK in
// supabase/migrations/20261113221252_booking_home_size.sql, and
// supabase/__tests__/booking-home-size.test.ts fails if the two drift apart.

export const HOME_SIZE_OPTIONS = [
  { value: "under-1800", label: "Under 1,800 sq ft" },
  { value: "1800-2500", label: "1,800 to 2,500 sq ft" },
  { value: "over-2500", label: "2,500 sq ft or more" },
  { value: "unsure", label: "Not sure" },
] as const;

export type HomeSize = (typeof HOME_SIZE_OPTIONS)[number]["value"];

export function isHomeSize(value: unknown): value is HomeSize {
  return typeof value === "string" && HOME_SIZE_OPTIONS.some((o) => o.value === value);
}

/**
 * The words for a size. `null` is a booking made before this was asked, so the
 * office sees that it was never recorded rather than a guess.
 */
export function homeSizeLabel(size: HomeSize | null | undefined): string {
  if (!size) return "Not recorded";
  return HOME_SIZE_OPTIONS.find((o) => o.value === size)!.label;
}
