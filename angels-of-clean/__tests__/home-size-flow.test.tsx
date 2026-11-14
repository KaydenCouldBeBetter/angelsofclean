import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// Admin Settings phase 2b, step 1: the booking form asks about how big the home
// is (the crew limit counts homes by size), requires an answer ("Not sure" is
// one), shows it on review and sends it with the booking.

const replaceMock = vi.fn();
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
const submitBookingMock = vi.fn();
vi.mock("@/app/actions/submitBooking", () => ({
  submitBooking: (...args: unknown[]) => submitBookingMock(...args),
}));

import { useBookingStore } from "@/store/bookingStore";
import BookingSummary from "@/components/booking/BookingSummary";
import PropertyPage from "@/app/residential/property/page";
import ReviewPage from "@/app/residential/review/page";

const RESIDENTIAL = {
  service: "standard" as const,
  frequency: "one-time" as const,
  address: "1 Test St",
  city: "Cicero",
  zip: "13039",
  date: "2099-01-05",
  timeSlot: "morning" as const,
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "(315) 555-0100",
};

let container: HTMLDivElement;
let root: Root;
const render = (element: React.ReactElement) => act(() => root.render(element));
const radios = () => [...container.querySelectorAll<HTMLInputElement>('[aria-labelledby="home-size-label"] input')];
const checked = () => radios().find((r) => r.checked)?.value ?? null;
const next = () =>
  [...container.querySelectorAll("button")].find((b) => /^Next/.test(b.textContent ?? "")) as HTMLButtonElement;
const click = (el: Element) => act(() => (el as HTMLElement).click());

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

describe("property step", () => {
  beforeEach(() => useBookingStore.setState(RESIDENTIAL));

  it("asks how big the home is, as a labelled group of four choices", () => {
    render(<PropertyPage />);
    const group = container.querySelector('[role="radiogroup"][aria-labelledby="home-size-label"]')!;
    expect(document.getElementById("home-size-label")!.textContent).toBe("About how big is your home?");
    expect([...group.querySelectorAll("label")].map((l) => l.textContent)).toEqual([
      "Under 1,800 sq ft",
      "1,800 to 2,500 sq ft",
      "2,500 sq ft or more",
      "Not sure",
    ]);
    expect(container.textContent).toContain("A rough guess is fine.");
  });

  it("starts with nothing chosen, so nobody is nudged into a size", () => {
    render(<PropertyPage />);
    expect(checked()).toBeNull();
  });

  it("won't go on without an answer, and says why in a way a screen reader announces", () => {
    render(<PropertyPage />);
    click(next());
    expect(pushMock).not.toHaveBeenCalled();
    const error = container.querySelector('[role="alert"]')!;
    expect(error.textContent).toBe("Choose your home's size, or Not sure.");
    expect(useBookingStore.getState().homeSize).toBeNull();
  });

  it("takes the error away as soon as a size is chosen", () => {
    render(<PropertyPage />);
    click(next());
    click(radios()[0]);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it.each([
    [0, "under-1800"],
    [1, "1800-2500"],
    [2, "over-2500"],
    [3, "unsure"],
  ])("choice %i is saved as %s, and the step moves on", (index, value) => {
    render(<PropertyPage />);
    click(radios()[index]);
    expect(checked()).toBe(value);
    click(next());
    expect(useBookingStore.getState().homeSize).toBe(value);
    expect(pushMock).toHaveBeenCalledWith("/residential/datetime");
  });

  it("'Not sure' counts as an answer", () => {
    render(<PropertyPage />);
    click(radios()[3]);
    click(next());
    expect(pushMock).toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("refills the saved size when the customer comes back", () => {
    useBookingStore.setState({ homeSize: "over-2500" });
    render(<PropertyPage />);
    expect(checked()).toBe("over-2500");
  });

  it("keeps the other answers when the size is saved", () => {
    useBookingStore.setState({ bedrooms: 4, bathrooms: 2.5 });
    render(<PropertyPage />);
    click(radios()[1]);
    click(next());
    const s = useBookingStore.getState();
    expect([s.bedrooms, s.bathrooms, s.homeSize]).toEqual([4, 2.5, "1800-2500"]);
  });
});

describe("review step", () => {
  const ready = (homeSize: "under-1800" | "1800-2500" | "over-2500" | "unsure" | null) =>
    useBookingStore.setState({ ...RESIDENTIAL, homeSize, formStartedAt: Date.now() - 90_000 });

  it("shows the size under Property Details", () => {
    ready("over-2500");
    render(<ReviewPage />);
    expect(container.textContent).toContain("Home size: 2,500 sq ft or more");
  });

  it("sends the size with the booking", async () => {
    submitBookingMock.mockResolvedValue({ success: true, bookingRef: "AOC-1042", bookingId: "b-1" });
    ready("1800-2500");
    render(<ReviewPage />);
    await act(async () => click([...container.querySelectorAll("button")].find((b) => /^Confirm Booking/.test(b.textContent ?? ""))!));
    expect(submitBookingMock.mock.calls[0][0]).toMatchObject({ homeSize: "1800-2500" });
  });

  it("sends a booking started before the question existed back to ask it, not to the server", () => {
    ready(null);
    render(<ReviewPage />);
    expect(replaceMock).toHaveBeenCalledWith("/residential/property?returnTo=review");
    expect(submitBookingMock).not.toHaveBeenCalled();
  });

  it("links 'edit' on Property Details back to the step that asks", () => {
    ready("unsure");
    render(<ReviewPage />);
    expect(container.querySelector('a[href="/residential/property?returnTo=review"]')).not.toBeNull();
  });
});

describe("booking summary sidebar", () => {
  it("lists the size under the property once it is chosen", () => {
    useBookingStore.setState({ ...RESIDENTIAL, homeSize: "unsure" });
    render(<BookingSummary />);
    const text = container.textContent!;
    expect(text).toContain("Home size");
    expect(text).toContain("Not sure");
  });

  it("leaves it out until a size is chosen", () => {
    useBookingStore.setState({ ...RESIDENTIAL, homeSize: null });
    render(<BookingSummary />);
    expect(container.textContent).not.toContain("Home size");
  });
});

describe("saved state", () => {
  it("is cleared with the rest of the booking", () => {
    useBookingStore.setState({ homeSize: "over-2500" });
    useBookingStore.getState().reset();
    expect(useBookingStore.getState().homeSize).toBeNull();
  });

  it("survives a reload within the tab (it is saved with the booking)", () => {
    useBookingStore.setState({ homeSize: "1800-2500" });
    const saved = JSON.parse(sessionStorage.getItem("booking-store")!);
    expect(saved.state.homeSize).toBe("1800-2500");
  });
});
