import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

let pathname = "/residential";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => pathname,
}));

// next/link needs the App Router at runtime; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock("@/app/actions/submitBooking", () => ({ submitBooking: vi.fn() }));
vi.mock("@/app/actions/submitCommercialQuote", () => ({ submitCommercialQuote: vi.fn() }));

import { useBookingStore } from "@/store/bookingStore";
import ResidentialShell from "@/components/booking/ResidentialShell";
import ResidentialService from "@/app/residential/page";
import ResidentialDateTime from "@/app/residential/datetime/page";
import CommercialFacility from "@/app/commercial/page";
import CommercialServices from "@/app/commercial/services/page";
import CommercialContact from "@/app/commercial/contact/page";
import { BUSINESS_PHONE, COMMERCIAL_STEP_LABELS, FREQUENCY_OPTIONS } from "@/lib/constants";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useBookingStore.getState().reset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderResidential(path: string, page: React.ReactNode) {
  pathname = path;
  act(() => root.render(<ResidentialShell>{page}</ResidentialShell>));
}

function renderCommercial(page: React.ReactNode) {
  act(() => root.render(page));
}

// The residential shell renders each step in a mobile and a desktop layout, so
// a group can appear twice; either copy is the same group.
function group(label: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!found) throw new Error(`No group labelled "${label}"`);
  return found;
}

const choiceValues = (el: HTMLElement) =>
  [...el.querySelectorAll("input")].map((i) => i.value);

const checkedValues = (el: HTMLElement) =>
  [...el.querySelectorAll("input")].filter((i) => i.checked).map((i) => i.value);

// What a screen reader gets: a real radio/checkbox that is checked, plus the
// visual cue (solid fill and a check mark) on the same choice.
function expectAnnouncedAndMarked(el: HTMLElement) {
  const checked = [...el.querySelectorAll("input")].filter((i) => i.checked);
  expect(checked.length).toBeGreaterThan(0);
  for (const input of checked) {
    const label = input.closest("label")!;
    expect(["radio", "checkbox"]).toContain(input.type);
    expect(label.hasAttribute("data-selected")).toBe(true);
    expect(label.className).toContain("bg-primary");
    expect(label.className).toContain("text-white");
    expect(label.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  }
  const unchecked = [...el.querySelectorAll("input")].filter((i) => !i.checked && !i.disabled);
  for (const input of unchecked) {
    const label = input.closest("label")!;
    expect(label.hasAttribute("data-selected")).toBe(false);
    expect(label.querySelector("svg")).toBeNull();
  }
}

const RESIDENTIAL = {
  service: "deep" as const,
  frequency: "monthly" as const,
  address: "1 Test St",
  city: "Cicero",
  zip: "13039",
};

const COMMERCIAL = {
  facilityType: "retail" as const,
  sqftRange: "5k+" as const,
  serviceAreas: ["lobbies", "restrooms"],
  commercialFrequency: "weekly" as const,
  schedulePreference: "after" as const,
};

describe("the shared desktop navbar and stepper", () => {
  function expectChrome(stepCount: number, currentStep: number) {
    const header = container.querySelector("header")!;
    expect(header.querySelector("img")?.getAttribute("alt")).toBe("Angels of Clean");
    expect(header.querySelector('a[href^="tel:"]')?.getAttribute("href")).toBe(BUSINESS_PHONE.tel);
    expect(header.textContent).toContain(BUSINESS_PHONE.display);

    const stepper = container.querySelector('nav[aria-label="Progress"]')!;
    expect(stepper.querySelectorAll("li")).toHaveLength(stepCount);
    const current = stepper.querySelectorAll('li[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain(`Step ${currentStep}`);
  }

  it("renders in the residential flow", () => {
    renderResidential("/residential", <ResidentialService />);
    expectChrome(6, 1);
  });

  it.each([
    ["facility", <CommercialFacility key="1" />, 1],
    ["services", <CommercialServices key="2" />, 2],
    ["contact", <CommercialContact key="3" />, 3],
  ] as const)("renders on the commercial %s step", (_name, page, step) => {
    useBookingStore.setState(COMMERCIAL);
    renderCommercial(page);
    expectChrome(COMMERCIAL_STEP_LABELS.length, step);
    expect(container.querySelector("header")?.textContent).toContain("Commercial Services");
  });

  it("uses the same logo and phone number in both flows", () => {
    renderResidential("/residential", <ResidentialService />);
    const residential = container.querySelector("header")!;
    const resLogo = residential.querySelector("img")!.getAttribute("src");
    const resPhone = residential.querySelector("a[href^='tel:']")!.outerHTML;

    act(() => root.unmount());
    root = createRoot(container);
    renderCommercial(<CommercialFacility />);
    const commercial = container.querySelector("header")!;

    expect(commercial.querySelector("img")!.getAttribute("src")).toBe(resLogo);
    expect(commercial.querySelector("a[href^='tel:']")!.outerHTML).toBe(resPhone);
  });
});

describe("the shared selectable control", () => {
  it("marks the saved choices on the residential service step", () => {
    useBookingStore.setState(RESIDENTIAL);
    renderResidential("/residential", <ResidentialService />);

    expect(checkedValues(group("Service type"))).toEqual(["deep"]);
    expect(checkedValues(group("Cleaning frequency"))).toEqual(["monthly"]);
    expectAnnouncedAndMarked(group("Service type"));
    expectAnnouncedAndMarked(group("Cleaning frequency"));
  });

  it("marks the date and the time slot on the residential date step", () => {
    useBookingStore.setState(RESIDENTIAL);
    renderResidential("/residential/datetime", <ResidentialDateTime />);

    expect(checkedValues(group("Select a date"))).toHaveLength(1);
    expectAnnouncedAndMarked(group("Select a date"));
    const slots = container.querySelector<HTMLElement>('[role="radiogroup"][aria-labelledby]')!;
    expect(checkedValues(slots)).toHaveLength(1);
    expectAnnouncedAndMarked(slots);
  });

  it("marks facility type and square footage on the commercial facility step", () => {
    useBookingStore.setState(COMMERCIAL);
    renderCommercial(<CommercialFacility />);

    expect(checkedValues(group("Facility type"))).toEqual(["retail"]);
    expect(checkedValues(group("Square footage range"))).toEqual(["5k+"]);
    expectAnnouncedAndMarked(group("Facility type"));
    expectAnnouncedAndMarked(group("Square footage range"));
  });

  it("marks every chosen service area (pick-many) on the commercial scope step", () => {
    useBookingStore.setState(COMMERCIAL);
    renderCommercial(<CommercialServices />);

    const areas = group("Areas requiring attention");
    expect(checkedValues(areas)).toEqual(["lobbies", "restrooms"]);
    expect([...areas.querySelectorAll("input")].every((i) => i.type === "checkbox")).toBe(true);
    expectAnnouncedAndMarked(areas);
  });

  it("marks frequency and schedule preference on the commercial contact step", () => {
    useBookingStore.setState(COMMERCIAL);
    renderCommercial(<CommercialContact />);

    expect(checkedValues(group("Cleaning frequency"))).toEqual(["weekly"]);
    expect(checkedValues(group("Schedule preference"))).toEqual(["after"]);
    expectAnnouncedAndMarked(group("Cleaning frequency"));
    expectAnnouncedAndMarked(group("Schedule preference"));
  });

  it("has no hand-rolled role=radio buttons left on any choice step", () => {
    useBookingStore.setState({ ...RESIDENTIAL, ...COMMERCIAL });
    renderResidential("/residential", <ResidentialService />);
    expect(container.querySelector('[role="radio"], [aria-checked]')).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    renderCommercial(<CommercialContact />);
    expect(container.querySelector('[role="radio"], [aria-checked]')).toBeNull();
  });

  it("lets the two copies of a residential step hold their own selection", () => {
    // The shell renders each step twice (mobile and desktop layouts). Their
    // radios must not share a name, or checking one would uncheck the other.
    renderResidential("/residential", <ResidentialService />);
    const copies = container.querySelectorAll('[aria-label="Cleaning frequency"]');
    expect(copies).toHaveLength(2);
    const names = [...copies].map((c) => c.querySelector("input")!.name);
    expect(names[0]).not.toBe(names[1]);
    expect(checkedValues(copies[0] as HTMLElement)).toEqual(["one-time"]);
    expect(checkedValues(copies[1] as HTMLElement)).toEqual(["one-time"]);
  });
});

describe("frequency order", () => {
  const LEAST_TO_MOST = ["one-time", "monthly", "bi-weekly", "weekly"];

  it("runs least to most frequent in the residential flow", () => {
    renderResidential("/residential", <ResidentialService />);

    expect(choiceValues(group("Cleaning frequency"))).toEqual(LEAST_TO_MOST);
    expect(FREQUENCY_OPTIONS.map((f) => f.id)).toEqual(LEAST_TO_MOST);
  });

  it("is the same order in the commercial flow, which then adds its extra options", () => {
    renderCommercial(<CommercialContact />);

    expect(choiceValues(group("Cleaning frequency"))).toEqual([...LEAST_TO_MOST, "2-3x", "daily"]);
  });

  it("shows the shared options in the same sequence in both flows", () => {
    renderResidential("/residential", <ResidentialService />);
    const residential = choiceValues(group("Cleaning frequency"));

    act(() => root.unmount());
    root = createRoot(container);
    renderCommercial(<CommercialContact />);
    const commercial = choiceValues(group("Cleaning frequency"));

    expect(commercial.slice(0, residential.length)).toEqual(residential);
  });
});
