import { describe, expect, it } from "vitest";
import {
  deriveInitials,
  formatUsPhone,
  groupJobsByDay,
  employeeJobsUrl,
  parseViewParam,
  parseWeekParam,
  toCalendarEvent,
  validateEmployeeInput,
  weekStartOf,
} from "../admin-employees";
import type { Job } from "../admin-types";

// 2026-11-13 is a Friday, noon in New York.
const NOW = new Date("2026-11-13T17:00:00Z");
const GOOD = { name: "Marcus T.", phone: "315.555.0142", hiredDate: "2026-11-01" };

describe("deriveInitials", () => {
  it.each([
    ["Marcus T.", "MT"],
    ["  ana   v.  ", "AV"],
    ["Rosa", "R"],
    ["Mary Jane Watson", "MJ"],
    ["Zoë Ñ.", "ZÑ"],
    ["- .", ""],
  ])("%s -> %s", (name, initials) => {
    expect(deriveInitials(name)).toBe(initials);
  });
});

describe("formatUsPhone", () => {
  it.each([
    ["3155550142", "(315) 555-0142"],
    ["(315) 555-0142", "(315) 555-0142"],
    ["1-315-555-0142", "(315) 555-0142"],
    ["+1 315 555 0142", "(315) 555-0142"],
  ])("%s", (raw, formatted) => {
    expect(formatUsPhone(raw)).toBe(formatted);
  });

  it.each(["", "555-0142", "315555014", "31555501422", "21555501422", "abc"])("rejects %j", (raw) => {
    expect(formatUsPhone(raw)).toBeNull();
  });
});

describe("validateEmployeeInput", () => {
  it("accepts good input, deriving initials and formatting the phone", () => {
    expect(validateEmployeeInput(GOOD, NOW)).toEqual({
      ok: true,
      value: { name: "Marcus T.", initials: "MT", phone: "(315) 555-0142", hiredDate: "2026-11-01" },
    });
  });

  it("collapses extra spaces in the name", () => {
    const result = validateEmployeeInput({ ...GOOD, name: "  Marcus    T. " }, NOW);
    expect(result.ok && result.value.name).toBe("Marcus T.");
  });

  it.each([null, undefined, "x", 5, []])("rejects a non-object (%j)", (raw) => {
    expect(validateEmployeeInput(raw, NOW).ok).toBe(false);
  });

  it.each([
    [{ ...GOOD, name: "" }, "Enter the employee's name."],
    [{ ...GOOD, name: "   " }, "Enter the employee's name."],
    [{ ...GOOD, name: 42 }, "Enter the employee's name."],
    [{ ...GOOD, name: "x".repeat(101) }, "That name is too long."],
    [{ ...GOOD, name: "123" }, "The name needs at least one letter."],
    [{ ...GOOD, phone: "555-0142" }, "Enter a 10-digit phone number."],
    [{ ...GOOD, phone: undefined }, "Enter a 10-digit phone number."],
    [{ ...GOOD, hiredDate: "" }, "Enter the hire date."],
    [{ ...GOOD, hiredDate: "2026-02-30" }, "Enter the hire date."],
    [{ ...GOOD, hiredDate: "1980-01-01" }, "That hire date is too far back."],
    [{ ...GOOD, hiredDate: "2028-01-01" }, "That hire date is too far ahead."],
  ])("rejects %j", (raw, error) => {
    expect(validateEmployeeInput(raw, NOW)).toEqual({ ok: false, error });
  });

  it("allows a hire date a few weeks ahead", () => {
    expect(validateEmployeeInput({ ...GOOD, hiredDate: "2026-12-01" }, NOW).ok).toBe(true);
  });

  it("measures 'ahead' from New York's today, not UTC's", () => {
    // 9 PM in New York on Nov 13 is already Nov 14 in UTC; a year ahead is Nov 13 2027.
    const lateNight = new Date("2026-11-14T02:00:00Z");
    expect(validateEmployeeInput({ ...GOOD, hiredDate: "2027-11-13" }, lateNight).ok).toBe(true);
    expect(validateEmployeeInput({ ...GOOD, hiredDate: "2027-11-14" }, lateNight).ok).toBe(false);
  });
});

describe("weekStartOf", () => {
  it.each([
    ["2026-11-09", "2026-11-09"], // Monday
    ["2026-11-13", "2026-11-09"], // Friday
    ["2026-11-15", "2026-11-09"], // Sunday belongs to the week before the next Monday
    ["2026-11-16", "2026-11-16"],
    ["2027-01-01", "2026-12-28"], // crosses the year
  ])("%s -> %s", (date, monday) => {
    expect(weekStartOf(date)).toBe(monday);
  });
});

describe("parseWeekParam", () => {
  it("snaps a valid date to its Monday", () => {
    expect(parseWeekParam("2026-11-13", "2026-01-01")).toBe("2026-11-09");
  });

  it.each([undefined, "", "garbage", "2026-13-40", "2026-11-13T00:00", ["x", "2026-11-16"]])(
    "falls back to this week for %j",
    (value) => {
      expect(parseWeekParam(value as string | undefined, "2026-11-13")).toBe("2026-11-09");
    },
  );

  it("takes the first value when the param is repeated", () => {
    expect(parseWeekParam(["2026-11-16", "2026-11-23"], "2026-11-13")).toBe("2026-11-16");
  });
});

function job(id: string, start: string): Job {
  return {
    id,
    bookingNumber: 1000,
    client: "Client",
    service: "Standard",
    address: "1 Main St",
    start,
    end: start,
    employeeIds: [],
    status: "confirmed",
  };
}

describe("groupJobsByDay", () => {
  it("returns the seven days Monday to Sunday, empty ones included", () => {
    const days = groupJobsByDay([], "2026-11-09");
    expect(days.map((d) => d.date)).toEqual([
      "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15",
    ]);
    expect(days.every((d) => d.jobs.length === 0)).toBe(true);
  });

  it("puts a job on the New York day it starts, even when UTC says tomorrow", () => {
    // 9 PM EST on Nov 10 is 02:00 UTC on Nov 11.
    const late = job("late", "2026-11-11T02:00:00Z");
    const days = groupJobsByDay([late], "2026-11-09");
    expect(days[1].jobs.map((j) => j.id)).toEqual(["late"]);
    expect(days[2].jobs).toEqual([]);
  });

  it("sorts each day's jobs by start time", () => {
    const days = groupJobsByDay(
      [job("pm", "2026-11-10T18:00:00Z"), job("am", "2026-11-10T13:00:00Z")],
      "2026-11-09",
    );
    expect(days[1].jobs.map((j) => j.id)).toEqual(["am", "pm"]);
  });

  it("leaves out jobs outside the week", () => {
    const days = groupJobsByDay([job("next", "2026-11-17T13:00:00Z")], "2026-11-09");
    expect(days.flatMap((d) => d.jobs)).toEqual([]);
  });
});

describe("parseViewParam", () => {
  it("is the calendar only when asked for exactly that", () => {
    expect(parseViewParam("calendar")).toBe("calendar");
    expect(parseViewParam(["calendar", "list"])).toBe("calendar");
  });

  it.each([undefined, "", "list", "Calendar", "month", ["list", "calendar"]])("is the list for %j", (value) => {
    expect(parseViewParam(value)).toBe("list");
  });
});

describe("employeeJobsUrl", () => {
  it("asks the jobs API for one employee's range", () => {
    expect(employeeJobsUrl("e-1", "2026-11-09", "2026-11-16")).toBe(
      "/api/admin/jobs?from=2026-11-09&to=2026-11-16&employee=e-1",
    );
  });
});

describe("toCalendarEvent", () => {
  it("places a job at its New York wall-clock time, whatever the viewer's zone", () => {
    // 8:00 AM-12:00 PM EST on Nov 10 is 13:00-17:00 UTC.
    const event = toCalendarEvent({ ...job("b-1", "2026-11-10T13:00:00Z"), end: "2026-11-10T17:00:00Z" });
    expect(event.start).toBe("2026-11-10T08:00:00");
    expect(event.end).toBe("2026-11-10T12:00:00");
  });

  it("is a link to the booking, titled with the client", () => {
    const event = toCalendarEvent(job("b-1", "2026-11-10T13:00:00Z"));
    expect(event).toMatchObject({ id: "b-1", title: "Client", url: "/admin/bookings/b-1" });
  });

  it("carries no contact details or notes", () => {
    const event = toCalendarEvent({
      ...job("b-1", "2026-11-10T13:00:00Z"),
      email: "jo@example.com",
      phone: "315-555-0100",
      notes: "gate code 4412",
    });
    expect(JSON.stringify(event)).not.toMatch(/jo@example|555|4412/);
  });
});
