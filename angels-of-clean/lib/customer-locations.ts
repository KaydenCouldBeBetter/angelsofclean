import type { ServicePlan, Visit } from "@/lib/customer-types";

// A business account's locations: the distinct service addresses across its
// visits and plans. There is no locations table; an address is a place once a
// visit or plan is there.

export interface Location {
  /** Stable key: the address lower-cased with spacing collapsed. */
  key: string;
  address: string;
  cityLine: string;
  upcomingCount: number;
  pastCount: number;
  /** Date label of the soonest upcoming visit, if any. */
  nextVisitLabel: string | null;
  /** "Weekly · Commercial cleaning" for each live plan here. */
  plans: string[];
}

const keyOf = (address: string, cityLine: string) =>
  `${address} ${cityLine}`.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Groups visits and plans by address. `today` is a New York "YYYY-MM-DD"; visits
 * dated before it count as past (cancelled ones count as neither).
 */
export function deriveLocations(visits: Visit[], plans: ServicePlan[], today: string): Location[] {
  const byKey = new Map<string, Location>();
  const nextDates = new Map<string, string>();

  const entry = (address: string, cityLine: string) => {
    const key = keyOf(address, cityLine);
    let loc = byKey.get(key);
    if (!loc) {
      loc = { key, address, cityLine, upcomingCount: 0, pastCount: 0, nextVisitLabel: null, plans: [] };
      byKey.set(key, loc);
    }
    return loc;
  };

  for (const plan of plans) {
    entry(plan.address, plan.cityLine).plans.push(`${plan.frequencyLabel} · ${plan.serviceLabel}`);
  }
  for (const visit of visits) {
    const loc = entry(visit.address, visit.cityLine);
    if (visit.status === "cancelled") continue;
    if (visit.date >= today) {
      loc.upcomingCount += 1;
      const soonest = nextDates.get(loc.key);
      if (soonest === undefined || visit.date < soonest) {
        nextDates.set(loc.key, visit.date);
        loc.nextVisitLabel = visit.dateLabel;
      }
    } else {
      loc.pastCount += 1;
    }
  }

  return [...byKey.values()].sort((a, b) => a.address.localeCompare(b.address));
}
