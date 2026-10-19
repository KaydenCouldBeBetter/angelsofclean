import { TIME_SLOT_WINDOWS } from "@/lib/constants";
import { nyWallClockToInstant } from "@/lib/datetime";
import type { TimeSlot } from "@/store/bookingStore";

// "Add to calendar" for the residential confirmation page. The slot windows
// are New York wall-clock times, so they go through lib/datetime.ts and are
// written out as UTC instants, which every calendar app reads the same way.

export interface CalendarEvent {
  title: string;
  /** "YYYY-MM-DD", a New York calendar date. */
  date: string;
  timeSlot: NonNullable<TimeSlot>;
  location: string;
  description: string;
  /** Stable id so re-adding the event updates it instead of duplicating it. */
  uid: string;
}

/** "20261020T120000Z" */
function toCalendarUtc(instant: Date): string {
  return instant.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function eventWindow(event: CalendarEvent): { start: Date; end: Date } {
  const window = TIME_SLOT_WINDOWS[event.timeSlot];
  return {
    start: nyWallClockToInstant(event.date, window.start),
    end: nyWallClockToInstant(event.date, window.end),
  };
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const { start, end } = eventWindow(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toCalendarUtc(start)}/${toCalendarUtc(end)}`,
    details: event.description,
    location: event.location,
    ctz: "America/New_York",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// RFC 5545 TEXT escaping.
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Content lines are folded at 75 octets; continuation lines start with a space.
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(event: CalendarEvent, now: Date = new Date()): string {
  const { start, end } = eventWindow(event);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Angels of Clean//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${toCalendarUtc(now)}`,
    `DTSTART:${toCalendarUtc(start)}`,
    `DTEND:${toCalendarUtc(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
