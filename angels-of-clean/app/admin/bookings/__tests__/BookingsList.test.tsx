import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BookingsList from "../BookingsList";

// Filtering by status or employee isn't built yet (backlog B30).
describe("BookingsList", () => {
  it.each(["All Status", "All Employees"])("%s is disabled and labelled Coming soon", (label) => {
    const html = renderToStaticMarkup(<BookingsList jobs={[]} employeeMap={{}} activeTab="all" />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const button = [...doc.querySelectorAll("button")].find((b) => b.textContent?.includes(label))!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("type")).toBe("button");
    expect(button.textContent).toContain("Coming soon");
  });
});
