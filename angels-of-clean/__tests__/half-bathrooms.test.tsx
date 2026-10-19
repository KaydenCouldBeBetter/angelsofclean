import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// B42 (data part): the property step counts bathrooms in half steps, Review and
// the confirmation show the half-bathroom count, and both the customer and the
// admin New Booking form can send one.

const replaceMock = vi.fn();
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const submitBookingMock = vi.fn();
const adminCreateBookingMock = vi.fn();
vi.mock("@/app/actions/submitBooking", () => ({
  submitBooking: (...args: unknown[]) => submitBookingMock(...args),
  adminCreateBooking: (...args: unknown[]) => adminCreateBookingMock(...args),
}));

import { useBookingStore } from "@/store/bookingStore";
import PropertyPage from "@/app/residential/property/page";
import ReviewPage from "@/app/residential/review/page";
import ConfirmationPage from "@/app/residential/confirmation/page";
import NewBookingModal from "@/app/admin/NewBookingModal";

const RESIDENTIAL = {
  service: "standard" as const,
  frequency: "one-time" as const,
  address: "1 Test St",
  city: "Cicero",
  zip: "13039",
  date: "2026-11-02",
  timeSlot: "morning" as const,
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "(315) 555-0100",
};

let container: HTMLDivElement;
let root: Root;

function render(element: React.ReactElement) {
  act(() => root.render(element));
}

function button(label: string) {
  const found = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(found, `button "${label}"`).not.toBeNull();
  return found!;
}

// Review shows each card line as its own <p> (mobile and desktop layouts).
function lines() {
  return Array.from(container.querySelectorAll("p"), (p) => p.textContent);
}

function click(target: HTMLButtonElement) {
  act(() => target.click());
}

// The polite live region inside a stepper: what a screen reader announces.
function announced(label: string) {
  return container
    .querySelector(`[role="group"][aria-labelledby="${label}-label"] [aria-live="polite"]`)
    ?.textContent;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  sessionStorage.clear();
  useBookingStore.getState().reset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("bathrooms stepper", () => {
  it("steps from 1 to 5 in halves, announcing each count with its unit", () => {
    useBookingStore.setState({ ...RESIDENTIAL, bathrooms: 1 });
    render(<PropertyPage />);

    const seen = [announced("Bathrooms")];
    for (let i = 0; i < 8; i++) {
      click(button("Increase Bathrooms"));
      seen.push(announced("Bathrooms"));
    }

    expect(seen).toEqual([
      "1 bathroom",
      "1.5 bathrooms",
      "2 bathrooms",
      "2.5 bathrooms",
      "3 bathrooms",
      "3.5 bathrooms",
      "4 bathrooms",
      "4.5 bathrooms",
      "5 bathrooms",
    ]);
  });

  it("stops at 1 and at 5", () => {
    useBookingStore.setState({ ...RESIDENTIAL, bathrooms: 1 });
    render(<PropertyPage />);
    expect(button("Decrease Bathrooms").disabled).toBe(true);
    expect(button("Increase Bathrooms").disabled).toBe(false);

    act(() => root.unmount());
    root = createRoot(container);
    useBookingStore.setState({ bathrooms: 5 });
    render(<PropertyPage />);
    expect(button("Increase Bathrooms").disabled).toBe(true);
    click(button("Decrease Bathrooms"));
    expect(announced("Bathrooms")).toBe("4.5 bathrooms");
  });

  it("saves a half-bathroom count on Next", () => {
    useBookingStore.setState({ ...RESIDENTIAL, bathrooms: 2 });
    render(<PropertyPage />);

    click(button("Increase Bathrooms"));
    act(() => {
      Array.from(container.querySelectorAll("button"))
        .find((b) => /^Next/.test(b.textContent ?? ""))!
        .click();
    });

    expect(useBookingStore.getState().bathrooms).toBe(2.5);
  });

  it("keeps bedrooms in whole steps", () => {
    useBookingStore.setState({ ...RESIDENTIAL, bedrooms: 1 });
    render(<PropertyPage />);

    expect(announced("Bedrooms")).toBe("1 bedroom");
    click(button("Increase Bedrooms"));
    expect(announced("Bedrooms")).toBe("2 bedrooms");
  });
});

describe("review step", () => {
  it('shows "2.5 Bathrooms" and sends 2.5 with the booking', async () => {
    submitBookingMock.mockResolvedValue({ success: true, bookingRef: "AOC-1042", bookingId: "b-1" });
    useBookingStore.setState({
      ...RESIDENTIAL,
      bedrooms: 3,
      bathrooms: 2.5,
      formStartedAt: Date.now() - 90_000,
    });
    render(<ReviewPage />);

    expect(lines()).toContain("3 Bedrooms, 2.5 Bathrooms");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((b) => /^Confirm Booking/.test(b.textContent ?? ""))!
        .click();
    });
    expect(submitBookingMock).toHaveBeenCalledTimes(1);
    expect(submitBookingMock.mock.calls[0][0]).toMatchObject({ bathrooms: 2.5 });
  });

  it('keeps "1 Bathroom" singular', () => {
    useBookingStore.setState({
      ...RESIDENTIAL,
      bedrooms: 1,
      bathrooms: 1,
      formStartedAt: Date.now() - 90_000,
    });
    render(<ReviewPage />);

    expect(lines()).toContain("1 Bedroom, 1 Bathroom");
  });
});

describe("confirmation page", () => {
  it.each([
    [3, 2.5, "3 Bedrooms · 2.5 Bathrooms"],
    [1, 1, "1 Bedroom · 1 Bathroom"],
  ])("shows %s bedrooms and %s bathrooms as %j", (bedrooms, bathrooms, text) => {
    useBookingStore.setState({ ...RESIDENTIAL, bedrooms, bathrooms });
    render(<ConfirmationPage />);

    expect(lines()).toContain(text);
  });
});

describe("admin New Booking form", () => {
  function bathroomsSelect() {
    return container.querySelector<HTMLSelectElement>("#nb-bath")!;
  }

  it("offers 1 to 5 bathrooms in half steps", () => {
    render(<NewBookingModal open onClose={() => {}} />);

    expect(Array.from(bathroomsSelect().options, (o) => o.textContent)).toEqual([
      "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5",
    ]);
  });

  it("sends the chosen half-bathroom count", async () => {
    adminCreateBookingMock.mockResolvedValue({ success: false, error: "stop here" });
    render(<NewBookingModal open onClose={() => {}} />);

    act(() => {
      bathroomsSelect().value = "2.5";
      bathroomsSelect().dispatchEvent(new Event("change", { bubbles: true }));
    });
    // Submit the form directly: the test checks what is sent, not the
    // browser's required-field checks.
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(adminCreateBookingMock).toHaveBeenCalledTimes(1);
    expect(adminCreateBookingMock.mock.calls[0][0]).toMatchObject({ bathrooms: 2.5 });
  });
});
