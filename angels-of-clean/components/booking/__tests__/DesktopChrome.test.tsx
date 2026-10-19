import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DesktopNavbar, { COMMERCIAL_NAV_TAGLINE } from "../DesktopNavbar";
import DesktopStepper from "../DesktopStepper";
import { BUSINESS_PHONE, COMMERCIAL_STEP_LABELS } from "@/lib/constants";

function doc(html: string) {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}

describe("DesktopNavbar", () => {
  it("shows the logo and the business phone as a tappable tel: link", () => {
    const el = doc(renderToStaticMarkup(<DesktopNavbar />));

    expect(el.querySelector("img")?.getAttribute("alt")).toBe("Angels of Clean");
    const phone = el.querySelector('a[href^="tel:"]');
    expect(phone?.getAttribute("href")).toBe(BUSINESS_PHONE.tel);
    expect(phone?.textContent).toBe(BUSINESS_PHONE.display);
  });

  it("adds only the tagline for the commercial flow", () => {
    const plain = doc(renderToStaticMarkup(<DesktopNavbar />));
    const commercial = doc(renderToStaticMarkup(<DesktopNavbar tagline={COMMERCIAL_NAV_TAGLINE} />));

    expect(plain.textContent).not.toContain(COMMERCIAL_NAV_TAGLINE);
    expect(commercial.textContent).toContain(COMMERCIAL_NAV_TAGLINE);
    expect(commercial.querySelector('a[href^="tel:"]')?.getAttribute("href")).toBe(BUSINESS_PHONE.tel);
  });
});

describe("DesktopStepper", () => {
  const steps = ["One", "Two", "Three"];

  it("renders one list item per step label", () => {
    const el = doc(renderToStaticMarkup(<DesktopStepper steps={steps} currentStep={1} />));

    expect(el.querySelector("nav")?.getAttribute("aria-label")).toBe("Progress");
    expect([...el.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "1Step 1: One",
      "2Step 2: Two",
      "3Step 3: Three",
    ]);
  });

  it("announces the current step and the completed ones", () => {
    const el = doc(renderToStaticMarkup(<DesktopStepper steps={steps} currentStep={2} />));
    const items = [...el.querySelectorAll("li")];

    expect(items.map((li) => li.getAttribute("aria-current"))).toEqual([null, "step", null]);
    expect(items[0].textContent).toContain("(completed)");
    expect(items[1].textContent).not.toContain("(completed)");
    expect(items[2].textContent).not.toContain("(completed)");
  });

  it("takes the commercial labels as they are", () => {
    const el = doc(
      renderToStaticMarkup(<DesktopStepper steps={COMMERCIAL_STEP_LABELS} currentStep={4} />),
    );

    expect(el.querySelectorAll("li")).toHaveLength(COMMERCIAL_STEP_LABELS.length);
    expect(el.textContent).toContain("Review & Request");
  });
});
