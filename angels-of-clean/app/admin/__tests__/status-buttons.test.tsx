import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Job, JobStatus } from "@/lib/admin-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// The real actions module pulls in the server-only Supabase client.
vi.mock("../actions", () => ({
  assignEmployees: vi.fn(),
  confirmBooking: vi.fn(),
  updateBookingStatus: vi.fn(),
}));

import BookingActions from "../bookings/[id]/BookingActions";
import JobRowActions from "../dashboard/JobRowActions";

function job(status: JobStatus): Job {
  return {
    id: "b-1",
    bookingNumber: 1001,
    client: "Jane D.",
    service: "Standard",
    address: "1 Main St",
    start: "2026-10-20T12:00:00Z",
    end: "2026-10-20T16:00:00Z",
    employeeIds: [],
    status,
  };
}

function buttons(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return new Map(
    [...doc.querySelectorAll("button")].map((b) => [b.textContent!.trim(), b.disabled] as const),
  );
}

// For each status: whether a button is missing, disabled, or enabled. The
// detail page offers exactly the next step in the flow, plus Cancel until the
// booking is done or cancelled.
const DETAIL_EXPECTED: Record<JobStatus, Record<string, "missing" | "disabled" | "enabled">> = {
  pending:   { "Confirm Booking": "enabled", "Mark In Progress": "missing", "Mark Complete": "disabled", "Cancel Booking": "enabled", "Assign Employee": "enabled" },
  confirmed: { "Confirm Booking": "missing", "Mark In Progress": "enabled", "Mark Complete": "disabled", "Cancel Booking": "enabled", "Assign Employee": "enabled" },
  active:    { "Confirm Booking": "missing", "Mark In Progress": "missing", "Mark Complete": "enabled",  "Cancel Booking": "enabled", "Assign Employee": "enabled" },
  done:      { "Confirm Booking": "missing", "Mark In Progress": "missing", "Mark Complete": "disabled", "Cancel Booking": "disabled", "Assign Employee": "disabled" },
  cancelled: { "Confirm Booking": "missing", "Mark In Progress": "missing", "Mark Complete": "disabled", "Cancel Booking": "disabled", "Assign Employee": "disabled" },
};

describe("BookingActions status buttons", () => {
  it.each(Object.entries(DETAIL_EXPECTED))("for a %s booking", (status, expected) => {
    const found = buttons(renderToStaticMarkup(<BookingActions job={job(status as JobStatus)} employees={[]} />));
    const actual = Object.fromEntries(
      Object.keys(expected).map((label) => [
        label,
        !found.has(label) ? "missing" : found.get(label) ? "disabled" : "enabled",
      ]),
    );
    expect(actual).toEqual(expected);
  });
});

describe("JobRowActions", () => {
  it.each(["pending", "confirmed", "active", "done", "cancelled"] as const)(
    "offers Confirm only while pending (%s)",
    (status) => {
      const found = buttons(renderToStaticMarkup(<JobRowActions jobId="b-1" client="Jane D." status={status} />));
      expect(found.has("Confirm")).toBe(status === "pending");
    },
  );
});
