import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import { addDaysToDateStr, isValidDateStr, nyDateStr, nyWallClockISO } from "@/lib/datetime";
import type { Job } from "@/lib/admin-types";

// What the admin Add Employee form sends, checked on the server before anything
// is written. Takes `unknown` because a Server Action's arguments come straight
// from the caller. The database repeats the hard limits (lengths, one phone
// number per person) and the admin check; these give a readable message first.

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export interface EmployeeInput {
  name: string;
  initials: string;
  phone: string; // stored as "(315) 555-0142"
  hiredDate: string; // "YYYY-MM-DD"
}

// The roster writes "First L." (see the seeded staff), so initials are the first
// letters of the first two words: "Marcus T." -> "MT", "Ana" -> "A".
export function deriveInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.replace(/[^\p{L}]/gu, "").charAt(0))
    .join("")
    .toUpperCase();
}

// US numbers only: ten digits, with or without a leading 1.
export function formatUsPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// A new hire can start a little in the future; nothing earlier than this is real.
const EARLIEST_HIRE_DATE = "1990-01-01";
const MAX_DAYS_AHEAD = 365;

export function validateEmployeeInput(raw: unknown, now: Date = new Date()): Validated<EmployeeInput> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Invalid employee details." };
  const input = raw as Record<string, unknown>;

  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (name === "") return { ok: false, error: "Enter the employee's name." };
  if (name.length > FIELD_MAX_LENGTHS.name) return { ok: false, error: "That name is too long." };
  const initials = deriveInitials(name);
  if (initials === "") return { ok: false, error: "The name needs at least one letter." };

  const phone = typeof input.phone === "string" ? formatUsPhone(input.phone) : null;
  if (!phone) return { ok: false, error: "Enter a 10-digit phone number." };

  const hiredDate = typeof input.hiredDate === "string" ? input.hiredDate.trim() : "";
  if (!isValidDateStr(hiredDate)) return { ok: false, error: "Enter the hire date." };
  if (hiredDate < EARLIEST_HIRE_DATE) return { ok: false, error: "That hire date is too far back." };
  if (hiredDate > addDaysToDateStr(nyDateStr(now), MAX_DAYS_AHEAD)) {
    return { ok: false, error: "That hire date is too far ahead." };
  }

  return { ok: true, value: { name, initials, phone, hiredDate } };
}

// Weekly schedule ---------------------------------------------------------------------------

// The Monday of the week containing a "YYYY-MM-DD" date. Calendar math in UTC.
export function weekStartOf(dateStr: string): string {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysToDateStr(dateStr, day === 0 ? -6 : 1 - day);
}

// `?week=` is untrusted: anything that isn't a real date falls back to `fallback`.
export function parseWeekParam(value: string | string[] | undefined, fallback: string): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && isValidDateStr(candidate) ? weekStartOf(candidate) : weekStartOf(fallback);
}

export interface ScheduleDay {
  date: string; // "YYYY-MM-DD", New York
  jobs: Job[];
}

// Seven days from `weekStart`, each with that day's jobs in start order. A job
// belongs to the New York day it starts on.
export function groupJobsByDay(jobs: Job[], weekStart: string): ScheduleDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToDateStr(weekStart, i);
    return {
      date,
      jobs: jobs.filter((job) => nyDateStr(job.start) === date).sort((a, b) => a.start.localeCompare(b.start)),
    };
  });
}

// Calendar view ------------------------------------------------------------------------------

export type ScheduleView = "list" | "calendar";

// `?view=` is untrusted: anything but "calendar" is the list.
export function parseViewParam(value: string | string[] | undefined): ScheduleView {
  return (Array.isArray(value) ? value[0] : value) === "calendar" ? "calendar" : "list";
}

// The jobs API call for one employee. FullCalendar's range end is exclusive and
// the API's `to` is inclusive; the extra day is harmless, since events outside
// the visible range aren't drawn.
export function employeeJobsUrl(employeeId: string, from: string, to: string): string {
  return `/api/admin/jobs?from=${from}&to=${to}&employee=${employeeId}`;
}

// A job as a FullCalendar event. The calendar runs in UTC-coercion mode (see
// CalendarView), so each job goes in as its offset-less New York wall-clock
// time and lands at the right slot for every viewer. `url` makes each event a
// real link, so it is keyboard-focusable and opens the booking.
export function toCalendarEvent(job: Job) {
  return {
    id: job.id,
    title: job.client,
    url: `/admin/bookings/${job.id}`,
    start: nyWallClockISO(job.start),
    end: nyWallClockISO(job.end),
    extendedProps: { service: job.service, address: job.address, status: job.status },
  };
}
