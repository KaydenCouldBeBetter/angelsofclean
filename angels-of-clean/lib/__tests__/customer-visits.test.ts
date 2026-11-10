import { describe, expect, it } from "vitest";
import { splitVisits } from "../customer-visits";
import type { Visit } from "../customer-types";
import type { BookingStatus } from "../supabase/types";

let n = 1000;
function visit(date: string, status: BookingStatus, ref?: string): Visit {
  n += 1;
  return {
    id: `id-${n}`,
    ref: ref ?? `AOC-${n}`,
    serviceLabel: "Standard Clean",
    frequencyLabel: "Weekly",
    date,
    dateLabel: date,
    timeLabel: "8:00 AM – 12:00 PM",
    address: "1 Main St",
    cityLine: "Syracuse, 13202",
    bedrooms: 2,
    bathroomsLabel: "1 Bathroom",
    status,
    planId: null,
  };
}

const TODAY = "2026-11-10";
const dates = (visits: Visit[]) => visits.map((v) => v.date);

describe("splitVisits", () => {
  it("puts open visits from today on in upcoming, soonest first", () => {
    const { upcoming, past } = splitVisits(
      [
        visit("2026-12-01", "confirmed"),
        visit("2026-11-10", "pending"),
        visit("2026-11-24", "confirmed"),
      ],
      TODAY,
    );
    expect(dates(upcoming)).toEqual(["2026-11-10", "2026-11-24", "2026-12-01"]);
    expect(past).toEqual([]);
  });

  it("puts done and cancelled visits in past, even ones dated in the future", () => {
    const { upcoming, past } = splitVisits(
      [visit("2026-12-01", "cancelled"), visit("2026-11-20", "done"), visit("2026-10-01", "done")],
      TODAY,
    );
    expect(upcoming).toEqual([]);
    expect(dates(past)).toEqual(["2026-12-01", "2026-11-20", "2026-10-01"]);
  });

  it("treats an unconfirmed request for a day that has gone as history", () => {
    const { upcoming, past } = splitVisits([visit("2026-11-02", "pending")], TODAY);
    expect(upcoming).toEqual([]);
    expect(past).toHaveLength(1);
  });

  it("keeps a visit that is in progress upcoming even if it started yesterday", () => {
    const { upcoming } = splitVisits([visit("2026-11-09", "active")], TODAY);
    expect(upcoming).toHaveLength(1);
  });

  it("lists past visits most recent first", () => {
    const { past } = splitVisits(
      [visit("2026-09-01", "done"), visit("2026-10-20", "done"), visit("2026-10-05", "cancelled")],
      TODAY,
    );
    expect(dates(past)).toEqual(["2026-10-20", "2026-10-05", "2026-09-01"]);
  });

  it("breaks a tie on the same day by booking number, numerically", () => {
    const { upcoming } = splitVisits(
      [visit("2026-11-20", "confirmed", "AOC-1010"), visit("2026-11-20", "confirmed", "AOC-999")],
      TODAY,
    );
    expect(upcoming.map((v) => v.ref)).toEqual(["AOC-999", "AOC-1010"]);
  });

  it("uses the date it is given, not the server's clock", () => {
    const v = [visit("2026-11-10", "confirmed")];
    expect(splitVisits(v, "2026-11-10").upcoming).toHaveLength(1);
    expect(splitVisits(v, "2026-11-11").upcoming).toHaveLength(0);
  });

  it("does not change its input", () => {
    const input = [visit("2026-12-01", "confirmed"), visit("2026-11-11", "confirmed")];
    const copy = [...input];
    splitVisits(input, TODAY);
    expect(input).toEqual(copy);
  });
});
