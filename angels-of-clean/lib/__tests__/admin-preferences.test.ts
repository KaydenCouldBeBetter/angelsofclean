import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_PREFERENCES,
  calendarSlotTimes,
  firstDayNumber,
  hourLabel,
  landingPath,
  preferencesFromRow,
  validatePreferences,
  type AdminPreferences,
} from "../admin-preferences";
import { displayNameFor } from "../admin-display-name";

const VALID: AdminPreferences = {
  landingPage: "calendar",
  calendarView: "month",
  weekStartsOn: "monday",
  calendarStartHour: 6,
  calendarEndHour: 20,
  unassignedListCollapsed: true,
  bookingsDefaultFilter: "upcoming",
};

describe("DEFAULT_ADMIN_PREFERENCES", () => {
  it("is the panel as it was before Settings existed", () => {
    expect(DEFAULT_ADMIN_PREFERENCES).toEqual({
      landingPage: "dashboard",
      calendarView: "week",
      weekStartsOn: "sunday",
      calendarStartHour: 7,
      calendarEndHour: 17,
      unassignedListCollapsed: false,
      bookingsDefaultFilter: "today",
    });
  });

  it("passes its own validation", () => {
    expect(validatePreferences(DEFAULT_ADMIN_PREFERENCES)).toEqual({ ok: true, value: DEFAULT_ADMIN_PREFERENCES });
  });
});

describe("validatePreferences", () => {
  it("accepts a valid set and returns only the known fields", () => {
    const result = validatePreferences({ ...VALID, extra: "ignored", user_id: "someone-else" });
    expect(result).toEqual({ ok: true, value: VALID });
  });

  it.each([null, undefined, "x", 7, []])("refuses %j as a whole", (raw) => {
    expect(validatePreferences(raw).ok).toBe(false);
  });

  it.each([
    ["landingPage", "settings"],
    ["landingPage", "../admin"],
    ["landingPage", 1],
    ["calendarView", "day"],
    ["weekStartsOn", "friday"],
    ["bookingsDefaultFilter", "cancelled"],
    ["unassignedListCollapsed", "true"],
    ["unassignedListCollapsed", 1],
    ["calendarStartHour", -1],
    ["calendarStartHour", 24],
    ["calendarStartHour", 6.5],
    ["calendarStartHour", "7"],
    ["calendarEndHour", 0],
    ["calendarEndHour", 25],
    ["calendarEndHour", NaN],
  ])("refuses %s = %j", (key, value) => {
    expect(validatePreferences({ ...VALID, [key]: value }).ok).toBe(false);
  });

  it("refuses a missing field", () => {
    const { weekStartsOn: _omit, ...rest } = VALID;
    void _omit;
    expect(validatePreferences(rest).ok).toBe(false);
  });

  it("allows the end hour to be midnight (24)", () => {
    expect(validatePreferences({ ...VALID, calendarStartHour: 8, calendarEndHour: 24 }).ok).toBe(true);
  });

  it("needs at least four visible hours, and says so", () => {
    expect(validatePreferences({ ...VALID, calendarStartHour: 8, calendarEndHour: 12 }).ok).toBe(true);
    const tooClose = validatePreferences({ ...VALID, calendarStartHour: 8, calendarEndHour: 11 });
    expect(tooClose).toEqual({ ok: false, error: "Show at least 4 hours on the calendar." });
    expect(validatePreferences({ ...VALID, calendarStartHour: 10, calendarEndHour: 9 }).ok).toBe(false);
  });
});

describe("preferencesFromRow", () => {
  const ROW = {
    landing_page: "bookings",
    calendar_view: "month",
    week_starts_on: "monday",
    calendar_start_hour: 6,
    calendar_end_hour: 20,
    unassigned_list_collapsed: true,
    bookings_default_filter: "all",
  };

  it("maps every column", () => {
    expect(preferencesFromRow(ROW)).toEqual({
      landingPage: "bookings",
      calendarView: "month",
      weekStartsOn: "monday",
      calendarStartHour: 6,
      calendarEndHour: 20,
      unassignedListCollapsed: true,
      bookingsDefaultFilter: "all",
    });
  });

  it("falls back to the default for a value the app doesn't know, one field at a time", () => {
    const result = preferencesFromRow({ ...ROW, landing_page: "reports", calendar_view: "day" });
    expect(result.landingPage).toBe("dashboard");
    expect(result.calendarView).toBe("week");
    expect(result.weekStartsOn).toBe("monday");
  });

  it("falls back to the default hours when the pair isn't usable", () => {
    const result = preferencesFromRow({ ...ROW, calendar_start_hour: 12, calendar_end_hour: 13 });
    expect(result.calendarStartHour).toBe(7);
    expect(result.calendarEndHour).toBe(17);
  });
});

describe("helpers", () => {
  it("landingPath maps each start page to its admin route", () => {
    expect(landingPath("dashboard")).toBe("/admin/dashboard");
    expect(landingPath("calendar")).toBe("/admin/calendar");
    expect(landingPath("bookings")).toBe("/admin/bookings");
  });

  it("firstDayNumber is FullCalendar's: 0 Sunday, 1 Monday", () => {
    expect(firstDayNumber("sunday")).toBe(0);
    expect(firstDayNumber("monday")).toBe(1);
  });

  it("calendarSlotTimes zero-pads and accepts 24:00:00", () => {
    expect(calendarSlotTimes({ calendarStartHour: 7, calendarEndHour: 17 })).toEqual({
      slotMinTime: "07:00:00",
      slotMaxTime: "17:00:00",
    });
    expect(calendarSlotTimes({ calendarStartHour: 0, calendarEndHour: 24 })).toEqual({
      slotMinTime: "00:00:00",
      slotMaxTime: "24:00:00",
    });
  });

  it("hourLabel reads like every other time in the app, whatever the machine's zone", () => {
    expect(hourLabel(0)).toBe("12:00 AM");
    expect(hourLabel(7)).toBe("7:00 AM");
    expect(hourLabel(12)).toBe("12:00 PM");
    expect(hourLabel(17)).toBe("5:00 PM");
    expect(hourLabel(24)).toBe("12:00 AM (midnight)");
  });
});

describe("displayNameFor", () => {
  it("prefers the saved full name, then name, then the start of the email", () => {
    expect(displayNameFor({ email: "kay@x.com", user_metadata: { full_name: "Kay Dee", name: "Other" } })).toBe("Kay Dee");
    expect(displayNameFor({ email: "kay@x.com", user_metadata: { name: "Other" } })).toBe("Other");
    expect(displayNameFor({ email: "kay@x.com", user_metadata: {} })).toBe("kay");
    expect(displayNameFor({ email: "kay@x.com", user_metadata: { full_name: "   " } })).toBe("kay");
  });

  it("falls back to Admin when there is nothing to show", () => {
    expect(displayNameFor({})).toBe("Admin");
    expect(displayNameFor({ email: null, user_metadata: null })).toBe("Admin");
  });

  it("ignores a name that isn't text", () => {
    expect(displayNameFor({ email: "kay@x.com", user_metadata: { full_name: 42 } })).toBe("kay");
  });
});
