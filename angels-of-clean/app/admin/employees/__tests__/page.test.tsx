import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Employee } from "@/lib/admin-types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// The dialog and archive controls call server actions; they only render here.
vi.mock("../actions", () => ({ createEmployee: vi.fn(), setEmployeeArchived: vi.fn() }));

const ACTIVE: Employee = { id: "e1", name: "Ana V.", initials: "AV", phone: "(315) 555-0101", hiredDate: "Jan 2024", archivedAt: null };
const ARCHIVED: Employee = {
  id: "e2", name: "Lisa P.", initials: "LP", phone: "(315) 555-0102", hiredDate: "Nov 2024",
  archivedAt: "2026-10-01T16:00:00Z",
};

const getEmployees = vi.fn();
vi.mock("@/lib/supabase/queries", () => ({
  getEmployees: () => getEmployees(),
  getTodayJobs: async () => ({ ok: true, data: [] }),
}));

import AdminEmployeesPage from "../page";

async function render(view?: string) {
  const html = renderToStaticMarkup(await AdminEmployeesPage({ searchParams: Promise.resolve({ view }) }));
  return new DOMParser().parseFromString(html, "text/html");
}

beforeEach(() => {
  getEmployees.mockResolvedValue({ ok: true, data: [ACTIVE, ARCHIVED] });
});

describe("AdminEmployeesPage", () => {
  it("shows only active employees by default, with counts on both tabs", async () => {
    const doc = await render();
    expect(doc.body.textContent).toContain("Ana V.");
    expect(doc.body.textContent).not.toContain("Lisa P.");
    expect(doc.body.textContent).toContain("Active (1)");
    expect(doc.body.textContent).toContain("Archived (1)");
  });

  it("shows archived employees, marked as archived, on the Archived tab", async () => {
    const doc = await render("archived");
    expect(doc.body.textContent).toContain("Lisa P.");
    expect(doc.body.textContent).not.toContain("Ana V.");
    expect(doc.body.textContent).toContain("Oct 1, 2026");
    expect(doc.body.textContent).toContain("Reactivate Lisa P.");
    expect(doc.body.textContent).not.toContain("Archive Lisa P.");
  });

  it("marks the current tab with aria-current", async () => {
    const doc = await render("archived");
    const current = doc.querySelector('nav a[aria-current="page"]');
    expect(current?.textContent).toContain("Archived");
  });

  it("treats an unknown view as the active list", async () => {
    const doc = await render("everyone");
    expect(doc.body.textContent).toContain("Ana V.");
    expect(doc.body.textContent).not.toContain("Lisa P.");
  });

  it("has a working Add Employee button, no longer disabled or 'Coming soon'", async () => {
    const doc = await render();
    const add = [...doc.querySelectorAll("button")].find((b) => b.textContent?.includes("Add Employee"))!;
    expect(add.disabled).toBe(false);
    expect(doc.body.textContent).not.toContain("Coming soon");
  });

  it("links each card's View Schedule to that employee's page", async () => {
    const doc = await render();
    const link = [...doc.querySelectorAll("a")].find((a) => a.textContent?.includes("View Schedule"))!;
    expect(link.getAttribute("href")).toBe("/admin/employees/e1");
    expect(link.textContent).toContain("for Ana V.");
  });

  it("explains an empty Archived tab", async () => {
    getEmployees.mockResolvedValue({ ok: true, data: [ACTIVE] });
    expect((await render("archived")).body.textContent).toContain("No archived employees.");
  });

  it("shows a retry banner instead of an empty roster when the lookup fails", async () => {
    getEmployees.mockResolvedValue({ ok: false });
    const doc = await render();
    expect(doc.querySelector('[role="alert"]')).not.toBeNull();
    expect(doc.body.textContent).not.toContain("No active employees");
  });
});
