import { formatNy, isValidDateStr, nyWallClockToInstant } from "@/lib/datetime";

const STYLES = {
  // "Monday, November 2, 2026": the review and confirmation pages.
  long: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
  // "Mon, Nov 2": the booking summary sidebar.
  short: { weekday: "short", month: "short", day: "numeric" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/**
 * A booking's "YYYY-MM-DD" date as a label for the customer. The date is a New
 * York calendar day, so it is anchored at noon New York time and formatted in
 * that zone: the browser's own zone can never move it to a neighbouring day.
 * Returns "" for anything that isn't a real date (Intl throws on an Invalid
 * Date, and a half-filled or tampered wizard state must not crash the page).
 */
export function formatBookingDate(dateStr: string, style: keyof typeof STYLES): string {
  if (!isValidDateStr(dateStr)) return "";
  return formatNy(nyWallClockToInstant(dateStr, "12:00:00"), STYLES[style]);
}
