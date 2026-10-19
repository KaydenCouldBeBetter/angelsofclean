import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const replaceMock = vi.fn();
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// next/link needs the App Router at runtime; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const submitBookingMock = vi.fn();
vi.mock("@/app/actions/submitBooking", () => ({
  submitBooking: (...args: unknown[]) => submitBookingMock(...args),
}));
const submitCommercialQuoteMock = vi.fn();
vi.mock("@/app/actions/submitCommercialQuote", () => ({
  submitCommercialQuote: (...args: unknown[]) => submitCommercialQuoteMock(...args),
}));

import { useBookingStore } from "@/store/bookingStore";
import HoneypotField from "@/components/booking/HoneypotField";
import ResidentialContact from "@/app/residential/contact/page";
import CommercialContact from "@/app/commercial/contact/page";
import ResidentialReview from "@/app/residential/review/page";
import CommercialReview from "@/app/commercial/review/page";
import { MIN_FILL_MS } from "@/lib/bot-check";

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

const COMMERCIAL = {
  facilityType: "office" as const,
  sqftRange: "1k-2k" as const,
  address: "100 Clinton Sq",
  city: "Syracuse",
  zip: "13202",
  name: "Dana Lee",
  businessName: "Northside Dental",
  email: "dana@example.com",
  phone: "(315) 555-0199",
  commercialFrequency: "weekly" as const,
};

let container: HTMLDivElement;
let root: Root;

function render(element: React.ReactElement) {
  act(() => root.render(element));
}

function honeypotInput(): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('input[name="website"]')!;
}

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function clickButton(label: RegExp) {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    label.test(b.textContent ?? ""),
  );
  expect(button, `button ${label}`).toBeDefined();
  act(() => button!.click());
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

describe("HoneypotField accessibility", () => {
  it("is hidden from screen readers and skipped by keyboard navigation", () => {
    render(<HoneypotField value="" onChange={() => {}} />);
    const input = honeypotInput();

    // aria-hidden on the wrapper takes the field and its label out of the
    // accessibility tree; tabIndex -1 keeps it out of the tab order.
    expect(input.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(input.tabIndex).toBe(-1);
    expect(input.autocomplete).toBe("off");
  });

  it("is moved off-screen, not hidden with display:none or visibility:hidden", () => {
    render(<HoneypotField value="" onChange={() => {}} />);
    const wrapper = honeypotInput().closest<HTMLElement>('[aria-hidden="true"]')!;

    expect(wrapper.style.position).toBe("absolute");
    expect(parseInt(wrapper.style.left, 10)).toBeLessThan(-1000);
    expect(wrapper.style.display).not.toBe("none");
    expect(wrapper.style.visibility).not.toBe("hidden");
    expect(wrapper.hidden).toBe(false);
    expect(honeypotInput().hidden).toBe(false);
    expect(honeypotInput().type).toBe("text");
  });

  it("reports what is typed into it", () => {
    const onChange = vi.fn();
    render(<HoneypotField value="" onChange={onChange} />);

    typeInto(honeypotInput(), "spam");

    expect(onChange).toHaveBeenCalledWith("spam");
  });
});

describe("contact steps carry the honeypot", () => {
  it("residential: an untouched honeypot is stored as empty on Next", () => {
    useBookingStore.setState({ ...RESIDENTIAL, formStartedAt: Date.now() });
    render(<ResidentialContact />);
    expect(honeypotInput()).not.toBeNull();

    clickButton(/^Next/);

    expect(useBookingStore.getState().honeypot).toBe("");
    expect(pushMock).toHaveBeenCalledWith("/residential/review");
  });

  it("residential: a filled honeypot is stored on Next", () => {
    useBookingStore.setState({ ...RESIDENTIAL, formStartedAt: Date.now() });
    render(<ResidentialContact />);

    typeInto(honeypotInput(), "http://spam.example");
    clickButton(/^Next/);

    expect(useBookingStore.getState().honeypot).toBe("http://spam.example");
  });

  it("commercial: an untouched honeypot is stored as empty on Next", () => {
    useBookingStore.setState({ ...COMMERCIAL, formStartedAt: Date.now() });
    render(<CommercialContact />);
    expect(honeypotInput()).not.toBeNull();

    clickButton(/^Next/);

    expect(useBookingStore.getState().honeypot).toBe("");
    expect(pushMock).toHaveBeenCalledWith("/commercial/review");
  });

  it("commercial: a filled honeypot is stored on Next", () => {
    useBookingStore.setState({ ...COMMERCIAL, formStartedAt: Date.now() });
    render(<CommercialContact />);

    typeInto(honeypotInput(), "http://spam.example");
    clickButton(/^Next/);

    expect(useBookingStore.getState().honeypot).toBe("http://spam.example");
  });
});

describe("review steps send the bot check to the server", () => {
  it("residential: sends the honeypot and the time since the first step", async () => {
    submitBookingMock.mockResolvedValue({ success: false, error: "stop" });
    useBookingStore.setState({
      ...RESIDENTIAL,
      honeypot: "",
      formStartedAt: Date.now() - 90_000,
    });
    render(<ResidentialReview />);

    await act(async () => clickButton(/^Confirm Booking/));

    expect(submitBookingMock).toHaveBeenCalledTimes(1);
    const [, botCheck] = submitBookingMock.mock.calls[0];
    expect(botCheck.website).toBe("");
    expect(botCheck.elapsedMs).toBeGreaterThanOrEqual(90_000);
    expect(botCheck.elapsedMs).toBeLessThan(120_000);
    expect(botCheck.elapsedMs).toBeGreaterThan(MIN_FILL_MS);
  });

  it("residential: sends a filled honeypot as typed", async () => {
    submitBookingMock.mockResolvedValue({ success: false, error: "stop" });
    useBookingStore.setState({
      ...RESIDENTIAL,
      honeypot: "http://spam.example",
      formStartedAt: Date.now() - 90_000,
    });
    render(<ResidentialReview />);

    await act(async () => clickButton(/^Confirm Booking/));

    expect(submitBookingMock.mock.calls[0][1].website).toBe("http://spam.example");
  });

  it("commercial: sends the honeypot and the time since the first step", async () => {
    submitCommercialQuoteMock.mockResolvedValue({ success: false, error: "stop" });
    useBookingStore.setState({
      ...COMMERCIAL,
      honeypot: "",
      formStartedAt: Date.now() - 90_000,
    });
    render(<CommercialReview />);

    await act(async () => clickButton(/^Submit Quote Request/));

    expect(submitCommercialQuoteMock).toHaveBeenCalledTimes(1);
    const [, botCheck] = submitCommercialQuoteMock.mock.calls[0];
    expect(botCheck.website).toBe("");
    expect(botCheck.elapsedMs).toBeGreaterThanOrEqual(90_000);
    expect(botCheck.elapsedMs).toBeLessThan(120_000);
  });

  it("residential: wizard state with no start time is sent back to step 1", () => {
    useBookingStore.setState({ ...RESIDENTIAL, formStartedAt: null });
    render(<ResidentialReview />);

    expect(replaceMock).toHaveBeenCalledWith("/residential");
  });

  it("commercial: wizard state with no start time is sent back to step 1", () => {
    useBookingStore.setState({ ...COMMERCIAL, formStartedAt: null });
    render(<CommercialReview />);

    expect(replaceMock).toHaveBeenCalledWith("/commercial");
  });

  it("residential: a complete wizard with a start time stays on the review step", () => {
    useBookingStore.setState({ ...RESIDENTIAL, formStartedAt: Date.now() - 90_000 });
    render(<ResidentialReview />);

    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe("fill-time clock in the store", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts on the first residential step and is not restarted by later edits", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    expect(useBookingStore.getState().formStartedAt).toBeNull();

    useBookingStore.getState().setStep1("standard", "one-time");
    const started = useBookingStore.getState().formStartedAt;
    expect(started).toBe(new Date("2026-10-19T12:00:00Z").getTime());

    vi.setSystemTime(new Date("2026-10-19T12:05:00Z"));
    useBookingStore.getState().setStep1("deep", "weekly");
    expect(useBookingStore.getState().formStartedAt).toBe(started);
  });

  it("starts on the first commercial step too", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));

    useBookingStore.getState().setCommercialStep1("office", "1k-2k", "100 Clinton Sq", "Syracuse", "13202");

    expect(useBookingStore.getState().formStartedAt).toBe(new Date("2026-10-19T12:00:00Z").getTime());
  });

  it("survives a reload (persisted) but the honeypot value does not", () => {
    useBookingStore.getState().setStep1("standard", "one-time");
    useBookingStore.getState().setHoneypot("spam");

    const stored = JSON.parse(sessionStorage.getItem("booking-store") ?? "{}");
    expect(typeof stored.state.formStartedAt).toBe("number");
    expect(stored.state).not.toHaveProperty("honeypot");
  });

  it("reset() clears both", () => {
    useBookingStore.getState().setStep1("standard", "one-time");
    useBookingStore.getState().setHoneypot("spam");

    useBookingStore.getState().reset();

    expect(useBookingStore.getState().formStartedAt).toBeNull();
    expect(useBookingStore.getState().honeypot).toBe("");
  });
});
