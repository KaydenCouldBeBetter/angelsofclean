import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AdminEmployeesPage from "../page";

vi.mock("@/lib/supabase/queries", () => ({
  getEmployees: async () => ({
    ok: true,
    data: [{ id: "e1", name: "Ana V.", initials: "AV", phone: "315-555-0101", hiredDate: "2024-01-01" }],
  }),
  getTodayJobs: async () => ({ ok: true, data: [] }),
}));

// Adding an employee and per-employee schedules aren't built yet.
describe("AdminEmployeesPage", () => {
  it.each(["+ Add Employee", "View Schedule"])("%s is disabled and labelled Coming soon", async (label) => {
    const doc = new DOMParser().parseFromString(renderToStaticMarkup(await AdminEmployeesPage()), "text/html");
    const button = [...doc.querySelectorAll("button")].find((b) => b.textContent?.includes(label))!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Coming soon");
  });
});
