import { formatWallClockTime } from "@/lib/datetime";
import type { Validated } from "@/lib/admin-employees";

// Per-admin display preferences (Settings page). They change how one admin's
// panel looks and starts up; they never grant or limit access. Every value here
// is also a CHECK in supabase/migrations/20261113202614_admin_preferences.sql,
// and supabase/__tests__/admin-preferences.test.ts fails if the two drift.

export const LANDING_PAGE_OPTIONS = [
  { value: "dashboard", label: "Dashboard", path: "/admin/dashboard" },
  { value: "calendar", label: "Calendar", path: "/admin/calendar" },
  { value: "bookings", label: "Bookings", path: "/admin/bookings" },
] as const;

export const CALENDAR_VIEW_OPTIONS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const;

// firstDay is FullCalendar's number: 0 is Sunday, 1 is Monday.
export const WEEK_START_OPTIONS = [
  { value: "sunday", label: "Sunday", firstDay: 0 },
  { value: "monday", label: "Monday", firstDay: 1 },
] as const;

export const BOOKINGS_FILTER_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
] as const;

export type LandingPage = (typeof LANDING_PAGE_OPTIONS)[number]["value"];
export type CalendarView = (typeof CALENDAR_VIEW_OPTIONS)[number]["value"];
export type WeekStart = (typeof WEEK_START_OPTIONS)[number]["value"];
export type BookingsFilter = (typeof BOOKINGS_FILTER_OPTIONS)[number]["value"];

// Hours are on New York's clock. The first visible hour runs 0-23, the last 1-24
// (24 is midnight), and at least MIN_VISIBLE_HOURS must show so the week grid
// can't be squeezed to nothing.
export const FIRST_HOUR_RANGE = { min: 0, max: 23 } as const;
export const LAST_HOUR_RANGE = { min: 1, max: 24 } as const;
export const MIN_VISIBLE_HOURS = 4;

// Browser storage key for the Unassigned list's hide/show choice made on the
// calendar itself. It overrides unassignedListCollapsed on that browser only;
// saving Settings clears it on the browser that saved.
export const TRAY_COLLAPSED_KEY = "admin-calendar-unassigned-collapsed";

export interface AdminPreferences {
  landingPage: LandingPage;
  calendarView: CalendarView;
  weekStartsOn: WeekStart;
  calendarStartHour: number;
  calendarEndHour: number;
  unassignedListCollapsed: boolean;
  bookingsDefaultFilter: BookingsFilter;
}

// What an admin who has never saved anything gets: the panel as it was before
// Settings existed. The database column defaults must equal these.
export const DEFAULT_ADMIN_PREFERENCES: AdminPreferences = {
  landingPage: "dashboard",
  calendarView: "week",
  weekStartsOn: "sunday",
  calendarStartHour: 7,
  calendarEndHour: 17,
  unassignedListCollapsed: false,
  bookingsDefaultFilter: "today",
};

function isOneOf<T extends string>(options: readonly { value: T }[], value: unknown): value is T {
  return typeof value === "string" && options.some((o) => o.value === value);
}

export const isLandingPage = (v: unknown): v is LandingPage => isOneOf(LANDING_PAGE_OPTIONS, v);
export const isCalendarView = (v: unknown): v is CalendarView => isOneOf(CALENDAR_VIEW_OPTIONS, v);
export const isWeekStart = (v: unknown): v is WeekStart => isOneOf(WEEK_START_OPTIONS, v);
export const isBookingsFilter = (v: unknown): v is BookingsFilter => isOneOf(BOOKINGS_FILTER_OPTIONS, v);

function isHour(value: unknown, range: { min: number; max: number }): value is number {
  return Number.isInteger(value) && (value as number) >= range.min && (value as number) <= range.max;
}

/** Where an admin lands after signing in. */
export function landingPath(page: LandingPage): string {
  return LANDING_PAGE_OPTIONS.find((o) => o.value === page)!.path;
}

/** "7:00 AM"; hour 24 reads "12:00 AM", so the label says which midnight. */
export function hourLabel(hour: number): string {
  if (hour === 24) return "12:00 AM (midnight)";
  return formatWallClockTime(new Date(Date.UTC(2000, 0, 1, hour)));
}

const pad = (hour: number) => String(hour).padStart(2, "0");

/** FullCalendar's slotMinTime / slotMaxTime for the chosen hours. */
export function calendarSlotTimes(prefs: Pick<AdminPreferences, "calendarStartHour" | "calendarEndHour">) {
  return {
    slotMinTime: `${pad(prefs.calendarStartHour)}:00:00`,
    slotMaxTime: `${pad(prefs.calendarEndHour)}:00:00`,
  };
}

/** FullCalendar's firstDay number for the chosen week start. */
export function firstDayNumber(weekStartsOn: WeekStart): number {
  return WEEK_START_OPTIONS.find((o) => o.value === weekStartsOn)!.firstDay;
}

/**
 * Checks what the Settings form sends. Takes `unknown` because a Server Action's
 * argument comes straight from the caller. The database repeats every rule as a
 * CHECK; this gives a readable message first.
 */
export function validatePreferences(raw: unknown): Validated<AdminPreferences> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Invalid preferences." };
  const input = raw as Record<string, unknown>;

  if (!isLandingPage(input.landingPage)) return { ok: false, error: "Choose a start page from the list." };
  if (!isCalendarView(input.calendarView)) return { ok: false, error: "Choose Week or Month for the calendar." };
  if (!isWeekStart(input.weekStartsOn)) return { ok: false, error: "Choose Sunday or Monday for the first day of the week." };
  if (!isHour(input.calendarStartHour, FIRST_HOUR_RANGE) || !isHour(input.calendarEndHour, LAST_HOUR_RANGE)) {
    return { ok: false, error: "Choose the calendar's first and last hour from the lists." };
  }
  if (input.calendarEndHour - input.calendarStartHour < MIN_VISIBLE_HOURS) {
    return { ok: false, error: `Show at least ${MIN_VISIBLE_HOURS} hours on the calendar.` };
  }
  if (typeof input.unassignedListCollapsed !== "boolean") return { ok: false, error: "Invalid preferences." };
  if (!isBookingsFilter(input.bookingsDefaultFilter)) return { ok: false, error: "Choose a default filter from the list." };

  return {
    ok: true,
    value: {
      landingPage: input.landingPage,
      calendarView: input.calendarView,
      weekStartsOn: input.weekStartsOn,
      calendarStartHour: input.calendarStartHour,
      calendarEndHour: input.calendarEndHour,
      unassignedListCollapsed: input.unassignedListCollapsed,
      bookingsDefaultFilter: input.bookingsDefaultFilter,
    },
  };
}

// The columns of admin_preferences the app reads (not user_id or updated_at).
export interface AdminPreferencesRow {
  landing_page: string;
  calendar_view: string;
  week_starts_on: string;
  calendar_start_hour: number;
  calendar_end_hour: number;
  unassigned_list_collapsed: boolean;
  bookings_default_filter: string;
}

/**
 * A database row as preferences. The CHECKs already guarantee every value, so a
 * value that isn't valid can only mean the schema moved on without the app;
 * that field falls back to its default rather than breaking the page.
 */
export function preferencesFromRow(row: AdminPreferencesRow): AdminPreferences {
  const d = DEFAULT_ADMIN_PREFERENCES;
  const hoursOk =
    isHour(row.calendar_start_hour, FIRST_HOUR_RANGE) &&
    isHour(row.calendar_end_hour, LAST_HOUR_RANGE) &&
    row.calendar_end_hour - row.calendar_start_hour >= MIN_VISIBLE_HOURS;
  return {
    landingPage: isLandingPage(row.landing_page) ? row.landing_page : d.landingPage,
    calendarView: isCalendarView(row.calendar_view) ? row.calendar_view : d.calendarView,
    weekStartsOn: isWeekStart(row.week_starts_on) ? row.week_starts_on : d.weekStartsOn,
    calendarStartHour: hoursOk ? row.calendar_start_hour : d.calendarStartHour,
    calendarEndHour: hoursOk ? row.calendar_end_hour : d.calendarEndHour,
    unassignedListCollapsed:
      typeof row.unassigned_list_collapsed === "boolean" ? row.unassigned_list_collapsed : d.unassignedListCollapsed,
    bookingsDefaultFilter: isBookingsFilter(row.bookings_default_filter)
      ? row.bookings_default_filter
      : d.bookingsDefaultFilter,
  };
}
