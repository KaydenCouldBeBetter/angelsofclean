import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BookingActions from "../BookingActions";
import type { Job } from "@/lib/admin-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../../../actions", () => ({ assignEmployees: vi.fn(), updateBookingStatus: vi.fn() }));

const job: Job = {
  id: "j1", bookingNumber: 1042, client: "A", service: "Standard Clean", address: "x",
  start: "2026-10-20T12:00:00Z", end: "2026-10-20T16:00:00Z", employeeIds: [], status: "pending",
};

// Reschedule, messaging and export aren't built; they must say so.
describe("BookingActions", () => {
  const doc = new DOMParser().parseFromString(
    renderToStaticMarkup(<BookingActions job={job} employees={[]} />),
    "text/html",
  );

  it.each(["Reschedule", "Send Client Message", "Print / Export"])(
    "%s is disabled and labelled Coming soon",
    (label) => {
      const button = [...doc.querySelectorAll("button")].find((b) => b.textContent?.includes(label))!;
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain("Coming soon");
    },
  );
});
