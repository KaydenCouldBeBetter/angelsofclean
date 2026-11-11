import { describe, expect, it } from "vitest";
import { deriveLocations } from "../customer-locations";
import type { ServicePlan, Visit } from "../customer-types";

const TODAY = "2026-11-10";

function visit(over: Partial<Visit>): Visit {
  return {
    id: "v",
    ref: "AOC-1",
    serviceLabel: "Commercial",
    frequencyLabel: "Weekly",
    date: "2026-11-20",
    dateLabel: "Friday, November 20, 2026",
    timeLabel: "6:00 PM – 9:00 PM",
    address: "10 Salina St",
    cityLine: "Syracuse, 13202",
    bedrooms: 0,
    bathroomsLabel: "1 Bathroom",
    status: "confirmed",
    planId: null,
    ...over,
  };
}

const plan = (over: Partial<ServicePlan> = {}): ServicePlan => ({
  id: "p",
  serviceLabel: "Commercial cleaning",
  frequencyLabel: "Weekly",
  address: "10 Salina St",
  cityLine: "Syracuse, 13202",
  status: "active",
  statusLabel: "Active",
  ...over,
});

describe("deriveLocations", () => {
  it("is empty with nothing to group", () => {
    expect(deriveLocations([], [], TODAY)).toEqual([]);
  });

  it("groups visits and plans by address, ignoring case and spacing", () => {
    const result = deriveLocations(
      [visit({ id: "a" }), visit({ id: "b", address: "10  salina st", date: "2026-11-01" })],
      [plan()],
      TODAY,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ upcomingCount: 1, pastCount: 1, plans: ["Weekly · Commercial cleaning"] });
  });

  it("separates different addresses, sorted by address", () => {
    const result = deriveLocations(
      [visit({ address: "99 Erie Blvd" }), visit({ address: "10 Salina St" })],
      [],
      TODAY,
    );
    expect(result.map((l) => l.address)).toEqual(["10 Salina St", "99 Erie Blvd"]);
  });

  it("names the soonest upcoming visit and counts today as upcoming", () => {
    const [loc] = deriveLocations(
      [
        visit({ id: "late", date: "2026-12-01", dateLabel: "Tuesday, December 1, 2026" }),
        visit({ id: "today", date: TODAY, dateLabel: "Tuesday, November 10, 2026" }),
      ],
      [],
      TODAY,
    );
    expect(loc.nextVisitLabel).toBe("Tuesday, November 10, 2026");
    expect(loc.upcomingCount).toBe(2);
  });

  it("does not count cancelled visits, but still lists the place", () => {
    const [loc] = deriveLocations([visit({ status: "cancelled" })], [], TODAY);
    expect(loc).toMatchObject({ upcomingCount: 0, pastCount: 0, nextVisitLabel: null });
  });

  it("lists a plan's address even with no visits", () => {
    const [loc] = deriveLocations([], [plan({ address: "5 Park Ave" })], TODAY);
    expect(loc.address).toBe("5 Park Ave");
    expect(loc.upcomingCount).toBe(0);
  });
});
