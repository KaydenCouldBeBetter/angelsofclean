import type { Visit } from "@/lib/customer-types";

// A visit is "upcoming" until it is done or cancelled, or its day has passed
// (a request nobody confirmed for a day now gone is history, not a to-do). One
// that is in progress stays upcoming even if it started yesterday.
function isUpcoming(visit: Visit, today: string): boolean {
  if (visit.status === "done" || visit.status === "cancelled") return false;
  return visit.status === "active" || visit.date >= today;
}

const byDateThenRef = (a: Visit, b: Visit) =>
  a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref, "en", { numeric: true });

/**
 * Splits a customer's visits for the portal. `today` is the New York date
 * ("YYYY-MM-DD", nyTodayStr()), passed in so the split never depends on the
 * server's zone. Upcoming runs soonest first; past runs most recent first.
 */
export function splitVisits(visits: Visit[], today: string): { upcoming: Visit[]; past: Visit[] } {
  const upcoming = visits.filter((v) => isUpcoming(v, today)).sort(byDateThenRef);
  const past = visits.filter((v) => !isUpcoming(v, today)).sort((a, b) => byDateThenRef(b, a));
  return { upcoming, past };
}
