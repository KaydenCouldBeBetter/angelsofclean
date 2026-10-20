/**
 * Finding 2 regression guard.
 *
 * ResidentialShell used to render each step twice (mobile hidden + desktop
 * hidden), so every HTML id was duplicated and labels pointed to the first
 * (mobile-hidden) element — leaving desktop fields with zero programmatic
 * labels.  The shell now renders children once; these tests confirm:
 *
 *   1. No id appears more than once in the rendered DOM.
 *   2. Every <input>, <select> and <textarea> that carries an id has exactly
 *      one associated <label> (i.e. HTMLInputElement.labels.length === 1).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

let pathname = "/residential";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => pathname,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { useBookingStore } from "@/store/bookingStore";
import ResidentialShell from "@/components/booking/ResidentialShell";
import AddressPage from "@/app/residential/address/page";
import PropertyPage from "@/app/residential/property/page";
import ContactPage from "@/app/residential/contact/page";

// Seed enough state so each step's guard doesn't redirect away.
const SEED = {
  service: "standard" as const,
  frequency: "one-time" as const,
  address: "1 Test St",
  city: "Cicero",
  zip: "13039",
  date: "2099-12-31",
  timeSlot: "morning" as const,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useBookingStore.getState().reset();
  useBookingStore.setState(SEED);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderStep(path: string, page: React.ReactNode) {
  pathname = path;
  act(() =>
    root.render(
      <ResidentialShell>
        {page}
      </ResidentialShell>,
    ),
  );
}

/** Collect all id= values from every element in the container. */
function allIds(): string[] {
  return [...container.querySelectorAll("[id]")].map((el) => el.id);
}

/** Inputs/selects/textareas that carry an id and should be labelled. */
function labelledControls(): HTMLInputElement[] {
  return [
    ...container.querySelectorAll<HTMLInputElement>("input[id], select[id], textarea[id]"),
  ].filter(
    // Exclude the honeypot — it intentionally lives off-screen and is
    // aria-hidden, but it still has a label (labels.length === 1 is fine).
    // We only skip truly hidden inputs (type=hidden) that can't have labels.
    (el) => (el as HTMLInputElement).type !== "hidden",
  );
}

describe("ResidentialShell — single render (Finding 2)", () => {
  const steps: Array<[string, string, React.ReactNode]> = [
    ["address", "/residential/address", <AddressPage key="addr" />],
    ["property", "/residential/property", <PropertyPage key="prop" />],
    ["contact", "/residential/contact", <ContactPage key="contact" />],
  ];

  it.each(steps)("%s step: no duplicate ids in the DOM", (_name, path, page) => {
    renderStep(path, page);

    const ids = allIds();
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    }
    expect(duplicates, `Duplicate ids: ${duplicates.join(", ")}`).toEqual([]);
  });

  it.each(steps)(
    "%s step: every input/select/textarea has exactly one label",
    (_name, path, page) => {
      renderStep(path, page);

      const controls = labelledControls();
      expect(controls.length).toBeGreaterThan(0);

      for (const control of controls) {
        const count = control.labels?.length ?? 0;
        expect(
          count,
          `#${control.id} has ${count} label(s), expected 1`,
        ).toBe(1);
      }
    },
  );
});
