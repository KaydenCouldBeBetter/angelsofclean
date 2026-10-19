import { describe, it, expect } from "vitest";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "../calendar-links";

const event: CalendarEvent = {
  title: "Angels of Clean: Standard Clean",
  date: "2026-10-20",
  timeSlot: "morning",
  location: "12 Main St, Syracuse, NY 13202",
  description: "Standard Clean · One-time\nConfirmation #1042",
  uid: "1042@angelsofclean",
};

describe("googleCalendarUrl", () => {
  it("points at Google Calendar with the New York slot as UTC", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    // 8 AM–12 PM EDT (UTC-4) on Oct 20
    expect(url.searchParams.get("dates")).toBe("20261020T120000Z/20261020T160000Z");
    expect(url.searchParams.get("location")).toBe(event.location);
    expect(url.searchParams.get("ctz")).toBe("America/New_York");
  });

  it("uses the EST offset after daylight saving ends", () => {
    const url = new URL(googleCalendarUrl({ ...event, date: "2026-11-10", timeSlot: "afternoon" }));
    // 12 PM–4 PM EST (UTC-5)
    expect(url.searchParams.get("dates")).toBe("20261110T170000Z/20261110T210000Z");
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(event, new Date("2026-10-01T00:00:00Z"));

  it("is a CRLF-terminated calendar with one event at the right time", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261020T120000Z\r\n");
    expect(ics).toContain("DTEND:20261020T160000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261001T000000Z\r\n");
    expect(ics).toContain("UID:1042@angelsofclean\r\n");
  });

  it("escapes commas, semicolons and newlines in text fields", () => {
    expect(ics).toContain("LOCATION:12 Main St\\, Syracuse\\, NY 13202");
    expect(ics).toContain("\\nConfirmation #1042");
    expect(buildIcs({ ...event, title: "a;b" })).toContain("SUMMARY:a\\;b");
  });

  it("folds lines longer than 75 octets", () => {
    const long = buildIcs({ ...event, description: "x".repeat(200) });
    for (const line of long.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});
