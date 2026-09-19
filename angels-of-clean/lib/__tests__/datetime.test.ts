import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatNyTime,
  formatNyTimeRange,
  nyDateStr,
  nyTodayStr,
  nyWallClockISO,
  nyWallClockToInstant,
} from "../datetime";

// The suite runs under TZ=UTC by default (vitest.config.ts). These assertions
// must hold regardless of the process zone — every helper pins America/New_York
// via Intl, so none of them depend on TZ.

afterEach(() => {
  vi.useRealTimers();
});

describe("nyWallClockToInstant", () => {
  it("maps a normal morning window to the correct UTC instants (EDT, -4)", () => {
    expect(nyWallClockToInstant("2026-08-01", "08:00:00").toISOString()).toBe(
      "2026-08-01T12:00:00.000Z",
    );
    expect(nyWallClockToInstant("2026-08-01", "12:00:00").toISOString()).toBe(
      "2026-08-01T16:00:00.000Z",
    );
  });

  it("handles both sides of the fall DST change (Nov 1, 2026)", () => {
    // Oct 31: EDT (-4). Nov 1: EST (-5), after the 2 AM fall-back.
    expect(nyWallClockToInstant("2026-10-31", "08:00:00").toISOString()).toBe(
      "2026-10-31T12:00:00.000Z",
    );
    expect(nyWallClockToInstant("2026-11-01", "08:00:00").toISOString()).toBe(
      "2026-11-01T13:00:00.000Z",
    );
  });

  it("handles both sides of the spring DST change (Mar 14, 2027)", () => {
    // Mar 13: EST (-5). Mar 14: EDT (-4), after the 2 AM spring-forward.
    expect(nyWallClockToInstant("2027-03-13", "08:00:00").toISOString()).toBe(
      "2027-03-13T13:00:00.000Z",
    );
    expect(nyWallClockToInstant("2027-03-14", "08:00:00").toISOString()).toBe(
      "2027-03-14T12:00:00.000Z",
    );
  });
});

describe("nyTodayStr / nyDateStr", () => {
  it("returns New York's today at 11:30 PM NY even though UTC is already the next day", () => {
    // 2026-11-18 23:30 EST (-5) = 2026-11-19 04:30 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T04:30:00.000Z"));
    expect(nyTodayStr()).toBe("2026-11-18");
  });

  it("reads the New York calendar date of a stored UTC instant", () => {
    // Midnight UTC on Nov 19 is still 7 PM (EST) on Nov 18 in New York.
    expect(nyDateStr("2026-11-19T00:00:00.000Z")).toBe("2026-11-18");
  });
});

describe("formatting helpers", () => {
  it("formats an instant as New York time with AM/PM", () => {
    // 12:00 UTC on Aug 1 = 8:00 AM EDT.
    expect(formatNyTime("2026-08-01T12:00:00.000Z")).toBe("8:00 AM");
    // 20:00 UTC on Aug 1 = 4:00 PM EDT.
    expect(formatNyTime("2026-08-01T20:00:00.000Z")).toBe("4:00 PM");
  });

  it("formats a New York time range", () => {
    expect(
      formatNyTimeRange("2026-08-01T12:00:00.000Z", "2026-08-01T16:00:00.000Z"),
    ).toBe("8:00 AM – 12:00 PM");
  });

  it("emits offset-less New York wall-clock ISO for FullCalendar", () => {
    expect(nyWallClockISO("2026-08-01T12:00:00.000Z")).toBe("2026-08-01T08:00:00");
  });
});
