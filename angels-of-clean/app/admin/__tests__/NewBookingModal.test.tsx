import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// Pass #2 finding 4: the New Booking modal is a real dialog. Role, name, focus
// in, Tab kept inside, Escape to close, focus back on "+ New Booking".

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/app/actions/submitBooking", () => ({ adminCreateBooking: vi.fn() }));

import { NewBookingButton } from "../NewBookingModal";

let container: HTMLDivElement;
let root: Root;

// Base UI moves focus after a frame or two, so give effects and timers a turn.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

function opener() {
  return container.querySelector("button")!;
}

function dialog() {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

async function openDialog() {
  opener().focus();
  await act(async () => {
    opener().click();
  });
  await settle();
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<NewBookingButton />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
});

describe("New Booking dialog", () => {
  it("is not in the page until it is opened", () => {
    expect(opener().textContent).toBe("+ New Booking");
    expect(dialog()).toBeNull();
  });

  it("is a modal dialog named by its heading", async () => {
    await openDialog();

    const el = dialog()!;
    expect(el).not.toBeNull();
    expect(el.getAttribute("aria-modal")).toBe("true");
    const heading = document.getElementById(el.getAttribute("aria-labelledby")!)!;
    expect(heading.textContent).toBe("New Booking");
    expect(heading.tagName).toBe("H2");
  });

  it("has a close button named “Close”, not the ✕ glyph", async () => {
    await openDialog();

    const close = dialog()!.querySelector<HTMLButtonElement>('button[aria-label="Close"]');
    expect(close).not.toBeNull();
    expect(close!.querySelector('[aria-hidden="true"]')!.textContent).toBe("✕");
  });

  it("moves focus into the dialog when it opens", async () => {
    await openDialog();

    expect(dialog()!.contains(document.activeElement)).toBe(true);
  });

  it("keeps the page behind it out of reach of Tab and screen readers", async () => {
    await openDialog();

    // Base UI traps focus with guards around the popup and hides everything
    // outside it from assistive technology.
    expect(document.querySelectorAll("[data-base-ui-focus-guard]").length).toBeGreaterThanOrEqual(2);
    expect(container.closest("[aria-hidden='true'], [inert]")).not.toBeNull();
    expect(dialog()!.closest("[aria-hidden='true'], [inert]")).toBeNull();
  });

  it("closes on Escape and puts focus back on “+ New Booking”", async () => {
    await openDialog();
    expect(dialog()).not.toBeNull();

    await act(async () => {
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    await settle();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener());
  });

  it("closes from the Close button and puts focus back on “+ New Booking”", async () => {
    await openDialog();

    await act(async () => {
      dialog()!.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
    });
    await settle();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener());
  });

  it("lists services and frequencies in the customer flows' order", async () => {
    await openDialog();

    const options = (id: string) =>
      Array.from(document.querySelectorAll<HTMLOptionElement>(`#${id} option`), (o) => [o.value, o.textContent]);
    expect(options("nb-service")).toEqual([
      ["standard", "Standard Clean"],
      ["deep", "Deep Clean"],
      ["moveinout", "Move-In / Move-Out"],
    ]);
    expect(options("nb-frequency")).toEqual([
      ["one-time", "One-time"],
      ["monthly", "Monthly"],
      ["bi-weekly", "Bi-weekly"],
      ["weekly", "Weekly"],
    ]);
  });
});
