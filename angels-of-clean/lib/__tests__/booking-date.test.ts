import { describe, it, expect } from "vitest";
import { formatBookingDate } from "@/lib/booking-date";

// The date is a New York calendar day: it prints the same in every time zone
// (the suite also runs under TZ=America/Los_Angeles).
describe("formatBookingDate", () => {
  it("formats the long label for the review and confirmation pages", () => {
    expect(formatBookingDate("2026-11-02", "long")).toBe("Monday, November 2, 2026");
    expect(formatBookingDate("2026-12-31", "long")).toBe("Thursday, December 31, 2026");
  });

  it("formats the short label for the booking summary", () => {
    expect(formatBookingDate("2026-11-02", "short")).toBe("Mon, Nov 2");
    expect(formatBookingDate("2026-03-08", "short")).toBe("Sun, Mar 8"); // DST starts
    expect(formatBookingDate("2026-11-01", "short")).toBe("Sun, Nov 1"); // DST ends
  });

  it("keeps the last day of a month and year", () => {
    expect(formatBookingDate("2026-10-31", "short")).toBe("Sat, Oct 31");
    expect(formatBookingDate("2027-01-01", "long")).toBe("Friday, January 1, 2027");
  });

  it.each(["", "2026-13-01", "2026-02-30", "11/02/2026", "tomorrow"])(
    "returns an empty label for %j instead of throwing",
    (value) => {
      expect(formatBookingDate(value, "long")).toBe("");
      expect(formatBookingDate(value, "short")).toBe("");
    },
  );
});
