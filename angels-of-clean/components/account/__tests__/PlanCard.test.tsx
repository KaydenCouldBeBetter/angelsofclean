import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PlanCard from "../PlanCard";
import type { ServicePlan } from "@/lib/customer-types";

// P1: the admin form tells staff "The customer sees these on their account."
const PLAN: ServicePlan = {
  id: "p1",
  serviceLabel: "Standard Clean",
  frequencyLabel: "Bi-weekly",
  address: "1 Main St",
  cityLine: "Syracuse, 13202",
  status: "active",
  statusLabel: "Active",
};

describe("PlanCard", () => {
  it("shows the office's notes for the customer", () => {
    const html = renderToStaticMarkup(<PlanCard plan={{ ...PLAN, notes: "Every other Wednesday" }} />);
    expect(html).toContain("Every other Wednesday");
  });

  it("wraps long words in the notes so a narrow phone never scrolls sideways (WCAG 1.4.10)", () => {
    const html = renderToStaticMarkup(<PlanCard plan={{ ...PLAN, notes: "https://example.com/" + "x".repeat(200) }} />);
    expect(html).toMatch(/<p class="[^"]*\bbreak-words\b[^"]*">https:\/\/example\.com/);
  });

  it("adds nothing when the plan has no notes", () => {
    const withNull = renderToStaticMarkup(<PlanCard plan={{ ...PLAN, notes: null }} />);
    const without = renderToStaticMarkup(<PlanCard plan={PLAN} />);
    expect(withNull).toBe(without);
  });
});
