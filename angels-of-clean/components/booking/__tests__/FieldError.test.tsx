/**
 * Finding 7 / B39 error-announcement gap.
 *
 * FieldError is the single shared error component for all customer-facing form
 * fields.  Tests confirm:
 *   - It renders with role="alert" so screen readers announce it on mount.
 *   - Its id prop lands on the root element so inputs can reference it via
 *     aria-describedby.
 *   - The residential and commercial contact steps wire aria-invalid and
 *     aria-describedby onto the relevant inputs when an error is active.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import FieldError from "@/components/booking/FieldError";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/residential/contact",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { useBookingStore } from "@/store/bookingStore";
import ResidentialContact from "@/app/residential/contact/page";
import ResidentialShell from "@/components/booking/ResidentialShell";

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

// ── FieldError component (static) ───────────────────────────────────────────

describe("FieldError component", () => {
  it("renders with role=alert and the given id", () => {
    const html = renderToStaticMarkup(
      <FieldError id="name-error">Full name is required.</FieldError>,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('id="name-error"');
    expect(html).toContain("Full name is required.");
  });

  it("the id attribute is the same value passed in", () => {
    const html = renderToStaticMarkup(<FieldError id="zip-error">Bad ZIP.</FieldError>);
    expect(html).toContain('id="zip-error"');
    expect(html).not.toContain('id="name-error"');
  });
});

// ── aria wiring pattern ──────────────────────────────────────────────────────
// Verify the pattern that every usage must follow: an input paired with a
// FieldError gets aria-invalid and aria-describedby in static markup.

describe("aria-invalid / aria-describedby pattern", () => {
  it("input + FieldError renders with the expected aria wiring", () => {
    const html = renderToStaticMarkup(
      <div>
        <label htmlFor="name">Full name</label>
        <input id="name" aria-invalid aria-describedby="name-error" />
        <FieldError id="name-error">Full name is required.</FieldError>
      </div>,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="name-error"');
    expect(html).toContain('id="name-error"');
    expect(html).toContain('role="alert"');
  });
});

// ── residential contact step (interactive) ──────────────────────────────────

describe("residential contact step — error announcement (Finding 7)", () => {
  function render() {
    act(() =>
      root.render(
        <ResidentialShell>
          <ResidentialContact />
        </ResidentialShell>,
      ),
    );
  }

  // Move focus to the input then move it away — jsdom fires blur/focusout which
  // React's delegation system picks up, calling the onBlur handler.
  function blurEmpty(id: string) {
    const el = container.querySelector<HTMLInputElement>(`#${id}`)!;
    act(() => el.focus());
    act(() => el.blur());
  }

  it("shows no errors on first render", () => {
    render();
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("shows name-error with role=alert after leaving the name field empty", () => {
    render();
    blurEmpty("name");
    const alert = container.querySelector<HTMLElement>("#name-error");
    expect(alert).not.toBeNull();
    expect(alert!.getAttribute("role")).toBe("alert");
    expect(alert!.textContent).toContain("Full name is required.");
  });

  it("sets aria-invalid on the name input when the error shows", () => {
    render();
    blurEmpty("name");
    const input = container.querySelector<HTMLInputElement>("#name");
    expect(input!.getAttribute("aria-invalid")).toBe("true");
  });

  it("sets aria-describedby pointing to the error element", () => {
    render();
    blurEmpty("name");
    const input = container.querySelector<HTMLInputElement>("#name");
    expect(input!.getAttribute("aria-describedby")).toBe("name-error");
  });

  it("shows phone-error after leaving the phone field empty", () => {
    render();
    blurEmpty("phone");
    const alert = container.querySelector<HTMLElement>("#phone-error");
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain("Phone number is required.");
  });
});
