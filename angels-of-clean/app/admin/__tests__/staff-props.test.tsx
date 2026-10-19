import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Employee, Job } from "@/lib/admin-types";

// Staff phone numbers stay on the server: the pages pass client components
// only what they show (id, name, initials), the same way B4 stopped sending
// customer contact details where they weren't needed.

const STAFF_PHONE = "315-555-0177";
const MARCUS: Employee = {
  id: "e-1",
  name: "Marcus T.",
  initials: "MT",
  phone: STAFF_PHONE,
  hiredDate: "Mar 2024",
};

const JOB: Job = {
  id: "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b",
  bookingNumber: 1042,
  client: "Sarah M.",
  service: "Standard Clean",
  address: "47 Elm Drive, Syracuse",
  start: "2026-11-02T13:00:00.000Z",
  end: "2026-11-02T17:00:00.000Z",
  employeeIds: ["e-1"],
  status: "pending",
  submittedAt: "2026-10-19T13:00:00.000Z",
};

vi.mock("@/lib/supabase/queries", () => ({
  getEmployees: async () => ({ ok: true, data: [MARCUS] }),
  getJobsInRange: async () => ({ ok: true, data: [JOB] }),
  getJobsByDateFilter: async () => ({ ok: true, data: [JOB] }),
  getJobById: async () => ({ ok: true, data: JOB }),
  getActivityLog: async () => ({ ok: true, data: [] }),
  getBookingAccess: async () => ({ ok: true, data: null }),
}));

// Each client component records the props it was given.
const received: Record<string, unknown> = {};
vi.mock("@/app/admin/calendar/CalendarView", () => ({
  default: (props: unknown) => ((received.CalendarView = props), null),
}));
vi.mock("@/app/admin/bookings/BookingsList", () => ({
  default: (props: unknown) => ((received.BookingsList = props), null),
}));
vi.mock("@/app/admin/bookings/[id]/BookingActions", () => ({
  default: (props: unknown) => ((received.BookingActions = props), null),
}));
vi.mock("@/app/admin/bookings/[id]/EntryInstructions", () => ({ default: () => null }));
vi.mock("@/app/admin/NewBookingModal", () => ({ NewBookingButton: () => null }));

import AdminCalendarPage from "@/app/admin/calendar/page";
import AdminBookingsPage from "@/app/admin/bookings/page";
import BookingDetailPage from "@/app/admin/bookings/[id]/page";

beforeEach(() => {
  for (const key of Object.keys(received)) delete received[key];
});

function expectNoStaffPhone(staff: unknown) {
  const json = JSON.stringify(staff);
  expect(json).not.toContain(STAFF_PHONE);
  expect(json).not.toContain('"phone"');
  expect(json).not.toContain("hiredDate");
}

describe("staff passed to admin client components", () => {
  it("the calendar gets names and initials, not phone numbers", async () => {
    renderToStaticMarkup(await AdminCalendarPage());

    const { employeeMap } = received.CalendarView as { employeeMap: unknown };
    expect(employeeMap).toEqual({ "e-1": { id: "e-1", name: "Marcus T.", initials: "MT" } });
    expectNoStaffPhone(employeeMap);
  });

  it("the bookings list gets names and initials, not phone numbers", async () => {
    renderToStaticMarkup(
      await AdminBookingsPage({ searchParams: Promise.resolve({ filter: "all" }) }),
    );

    const { employeeMap } = received.BookingsList as { employeeMap: unknown };
    expect(employeeMap).toEqual({ "e-1": { id: "e-1", name: "Marcus T.", initials: "MT" } });
    expectNoStaffPhone(employeeMap);
  });

  it("the booking detail actions get names and initials, not phone numbers", async () => {
    renderToStaticMarkup(await BookingDetailPage({ params: Promise.resolve({ id: JOB.id }) }));

    const { employees } = received.BookingActions as { employees: unknown };
    expect(employees).toEqual([{ id: "e-1", name: "Marcus T.", initials: "MT" }]);
    expectNoStaffPhone(employees);
  });
});
