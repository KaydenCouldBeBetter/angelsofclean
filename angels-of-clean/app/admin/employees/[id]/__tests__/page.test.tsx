import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Employee, Job } from "@/lib/admin-types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../../actions", () => ({ createEmployee: vi.fn(), setEmployeeArchived: vi.fn() }));
// FullCalendar doesn't render in a static test; the page only has to hand it the right props.
vi.mock("../EmployeeCalendar", () => ({
  default: (props: { employeeId: string; employeeName: string; initialDate: string }) => (
    <div data-testid="calendar" data-employee={props.employeeId} data-name={props.employeeName} data-date={props.initialDate} />
  ),
}));
vi.mock("@/lib/datetime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/datetime")>()),
  nyTodayStr: () => "2026-11-13", // a Friday
}));

const getEmployeeById = vi.fn();
const getEmployeeHistory = vi.fn();
const getEmployeeJobsInRange = vi.fn();
vi.mock("@/lib/supabase/queries", () => ({
  getEmployeeById: (...a: unknown[]) => getEmployeeById(...a),
  getEmployeeHistory: (...a: unknown[]) => getEmployeeHistory(...a),
  getEmployeeJobsInRange: (...a: unknown[]) => getEmployeeJobsInRange(...a),
}));

import EmployeeSchedulePage from "../page";

const ID = "11111111-1111-4111-8111-111111111111";
const ANA: Employee = { id: ID, name: "Ana V.", initials: "AV", phone: "(315) 555-0101", hiredDate: "Jan 2024", archivedAt: null };
const JOB: Job = {
  id: "22222222-2222-4222-8222-222222222222",
  bookingNumber: 1042,
  client: "Jo Client",
  service: "Deep Clean",
  address: "1 Main St",
  // 8:00 AM–12:00 PM on Tue Nov 10, New York (EST, UTC-5).
  start: "2026-11-10T13:00:00Z",
  end: "2026-11-10T17:00:00Z",
  employeeIds: [ID],
  status: "confirmed",
};

async function render(id = ID, week?: string, view?: string) {
  const html = renderToStaticMarkup(
    await EmployeeSchedulePage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ week, view }) }),
  );
  return new DOMParser().parseFromString(html, "text/html");
}

beforeEach(() => {
  vi.clearAllMocks();
  getEmployeeById.mockResolvedValue({ ok: true, data: ANA });
  getEmployeeJobsInRange.mockResolvedValue({ ok: true, data: [JOB] });
  getEmployeeHistory.mockResolvedValue({
    ok: true,
    data: [{ action: "hired", actor: "admin@example.com", at: "2024-01-02T15:00:00Z" }],
  });
});

describe("EmployeeSchedulePage", () => {
  it("shows the current Monday-to-Sunday week by default and asks for exactly that range", async () => {
    const doc = await render();
    expect(getEmployeeJobsInRange).toHaveBeenCalledWith(ID, "2026-11-09", "2026-11-15");
    expect(doc.querySelector("#week-heading")?.textContent).toBe("Nov 9 – Nov 15, 2026");
  });

  it("lists the job on its day with time, client, address and a link to the booking", async () => {
    const doc = await render();
    const link = doc.querySelector(`a[href="/admin/bookings/${JOB.id}"]`)!;
    expect(link.textContent).toContain("8:00 AM");
    expect(link.textContent).toContain("Jo Client");
    expect(link.textContent).toContain("#1042");
    expect(link.textContent).toContain("1 Main St");
    expect(doc.body.textContent).toContain("Tuesday, Nov 10");
  });

  it("says 'No jobs' for the empty days", async () => {
    const doc = await render();
    expect(doc.body.textContent?.match(/No jobs/g)).toHaveLength(6);
  });

  it("marks today", async () => {
    expect((await render()).body.textContent).toContain("Friday, Nov 13Today");
  });

  it("pages by week and offers a way back to this week", async () => {
    const doc = await render(ID, "2026-11-24");
    expect(getEmployeeJobsInRange).toHaveBeenCalledWith(ID, "2026-11-23", "2026-11-29");
    const hrefs = [...doc.querySelectorAll('nav[aria-label="Week"] a')].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["?week=2026-11-16", `/admin/employees/${ID}`, "?week=2026-11-30"]);
  });

  it("doesn't offer 'This week' while already on it", async () => {
    const doc = await render();
    expect(doc.querySelector('nav[aria-label="Week"]')?.textContent).not.toContain("This week");
  });

  it("falls back to this week for a junk ?week", async () => {
    await render(ID, "not-a-date");
    expect(getEmployeeJobsInRange).toHaveBeenCalledWith(ID, "2026-11-09", "2026-11-15");
  });

  it("shows the employment record", async () => {
    const doc = await render();
    expect(doc.body.textContent).toContain("Employment record");
    expect(doc.body.textContent).toContain("Hired Jan 2, 2024 by admin@example.com");
  });

  it("marks an archived employee and offers Reactivate", async () => {
    getEmployeeById.mockResolvedValue({ ok: true, data: { ...ANA, archivedAt: "2026-10-01T16:00:00Z" } });
    getEmployeeHistory.mockResolvedValue({
      ok: true,
      data: [
        { action: "hired", actor: null, at: "2024-01-02T15:00:00Z" },
        { action: "archived", actor: "admin@example.com", at: "2026-10-01T16:00:00Z" },
      ],
    });
    const doc = await render();
    expect(doc.body.textContent).toContain("Archived");
    expect(doc.body.textContent).toContain("Reactivate Ana V.");
    expect(doc.body.textContent).toContain("Archived Oct 1, 2026 by admin@example.com");
  });

  it("says 'Employee not found' for a malformed id without querying", async () => {
    const doc = await render("not-a-uuid");
    expect(doc.body.textContent).toContain("Employee not found.");
    expect(getEmployeeById).not.toHaveBeenCalled();
  });

  it("says 'Employee not found' for an id nobody has", async () => {
    getEmployeeById.mockResolvedValue({ ok: true, data: null });
    expect((await render()).body.textContent).toContain("Employee not found.");
  });

  it("shows a retry banner, not 'not found', when a lookup fails", async () => {
    getEmployeeById.mockResolvedValue({ ok: false });
    const doc = await render();
    expect(doc.querySelector('[role="alert"]')).not.toBeNull();
    expect(doc.body.textContent).not.toContain("Employee not found");
  });

  it("still shows the schedule if only the employment record fails to load", async () => {
    getEmployeeHistory.mockResolvedValue({ ok: false });
    const doc = await render();
    expect(doc.body.textContent).toContain("Jo Client");
    expect(doc.body.textContent).toContain("The record couldn't be loaded.");
  });

  describe("calendar view", () => {
    it("shows the calendar for this employee, starting on the chosen week", async () => {
      const doc = await render(ID, "2026-11-24", "calendar");
      const calendar = doc.querySelector('[data-testid="calendar"]')!;
      expect(calendar.getAttribute("data-employee")).toBe(ID);
      expect(calendar.getAttribute("data-name")).toBe("Ana V.");
      expect(calendar.getAttribute("data-date")).toBe("2026-11-23");
    });

    it("leaves the job loading to the calendar and drops the list", async () => {
      const doc = await render(ID, undefined, "calendar");
      expect(getEmployeeJobsInRange).not.toHaveBeenCalled();
      expect(doc.body.textContent).not.toContain("No jobs");
      expect(doc.querySelector('nav[aria-label="Week"]')).toBeNull();
    });

    it("still shows the employee and their employment record", async () => {
      const doc = await render(ID, undefined, "calendar");
      expect(doc.body.textContent).toContain("(315) 555-0101");
      expect(doc.body.textContent).toContain("Employment record");
    });
  });

  describe("view toggle", () => {
    const toggle = (doc: Document) =>
      [...doc.querySelectorAll('nav[aria-label="Schedule view"] a')].map((a) => [
        a.textContent,
        a.getAttribute("href"),
        a.getAttribute("aria-current"),
      ]);

    it("marks the list as current by default and keeps the week when switching", async () => {
      expect(toggle(await render(ID, "2026-11-24"))).toEqual([
        ["List", "?view=list&week=2026-11-23", "page"],
        ["Calendar", "?view=calendar&week=2026-11-23", null],
      ]);
    });

    it("marks the calendar as current in calendar view", async () => {
      expect(toggle(await render(ID, undefined, "calendar"))).toEqual([
        ["List", "?view=list&week=2026-11-09", null],
        ["Calendar", "?view=calendar&week=2026-11-09", "page"],
      ]);
    });

    it("treats an unknown view as the list", async () => {
      const doc = await render(ID, undefined, "month");
      expect(doc.querySelector('[data-testid="calendar"]')).toBeNull();
      expect(getEmployeeJobsInRange).toHaveBeenCalled();
    });
  });
});
