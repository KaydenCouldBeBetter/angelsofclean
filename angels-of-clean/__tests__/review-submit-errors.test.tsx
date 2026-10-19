import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const replaceMock = vi.fn();
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
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

const submitQuoteMock = vi.fn();
vi.mock("@/app/actions/submitCommercialQuote", () => ({
  submitCommercialQuote: (...args: unknown[]) => submitQuoteMock(...args),
}));

import { useBookingStore } from "@/store/bookingStore";
import { BUSINESS_PHONE } from "@/lib/constants";
import ResidentialReview from "@/app/residential/review/page";
import CommercialReview from "@/app/commercial/review/page";

const RESIDENTIAL = {
  service: "standard" as const,
  frequency: "one-time" as const,
  address: "1 Test St",
  city: "Cicero",
  zip: "13039",
  bedrooms: 2,
  bathrooms: 1,
  notes: "",
  date: "2099-01-05",
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
  floors: 3,
  serviceAreas: ["lobbies"],
  commercialNotes: "",
  name: "Dana Lee",
  businessName: "Northside Dental",
  email: "dana@example.com",
  phone: "(315) 555-0199",
  commercialFrequency: "weekly" as const,
  schedulePreference: "after" as const,
};

let container: HTMLDivElement;
let root: Root;

function render(element: React.ReactElement) {
  act(() => root.render(element));
}

function buttonsNamed(text: string) {
  return [...container.querySelectorAll("button")].filter((b) => b.textContent === text);
}

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.click();
  });
}

function alertBox() {
  return container.querySelector('[role="alert"]');
}

function telLinks() {
  return [...container.querySelectorAll("a")].filter(
    (a) => a.getAttribute("href") === BUSINESS_PHONE.tel,
  );
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  useBookingStore.getState().reset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe.each([
  {
    flow: "residential",
    subject: "booking",
    notSent: "Your booking was not sent",
    confirm: "Confirm Booking",
    submitMock: submitBookingMock,
    Page: ResidentialReview,
    state: RESIDENTIAL,
    successResult: { success: true, bookingRef: "AOC-1043" },
    confirmationUrl: "/residential/confirmation?ref=AOC-1043",
  },
  {
    flow: "commercial",
    subject: "request",
    notSent: "Your request was not sent",
    confirm: "Submit Quote Request",
    submitMock: submitQuoteMock,
    Page: CommercialReview,
    state: COMMERCIAL,
    successResult: { success: true, quoteRef: "COM-1007" },
    confirmationUrl: "/commercial/confirmation?ref=COM-1007",
  },
])("$flow review: submit failures", (flow) => {
  beforeEach(() => {
    useBookingStore.setState(flow.state);
  });

  it("shows an alert with an icon, a Try again button and the business phone", async () => {
    flow.submitMock.mockResolvedValue({ success: false, error: "Invalid email address." });
    render(<flow.Page />);

    await click(buttonsNamed(flow.confirm)[0]);

    const alert = alertBox();
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain(flow.notSent);
    expect(alert!.textContent).toContain("Invalid email address.");
    // Not color alone: the alert carries a decorative icon.
    expect(alert!.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(buttonsNamed("Try again")).toHaveLength(1);
    const phone = telLinks();
    expect(phone).toHaveLength(1);
    expect(phone[0].textContent).toBe(BUSINESS_PHONE.display);
    // An ordinary failure is not the outage screen.
    expect(container.textContent).not.toContain("Error 503");
  });

  it("Try again sends the form a second time and continues on success", async () => {
    flow.submitMock
      .mockResolvedValueOnce({ success: false, error: "Invalid email address." })
      .mockResolvedValueOnce(flow.successResult);
    render(<flow.Page />);
    await click(buttonsNamed(flow.confirm)[0]);

    await click(buttonsNamed("Try again")[0]);

    expect(flow.submitMock).toHaveBeenCalledTimes(2);
    expect(pushMock).toHaveBeenCalledWith(flow.confirmationUrl);
  });

  it("explains a request that never reached the server, and lets the customer retry", async () => {
    flow.submitMock.mockRejectedValue(new Error("fetch failed"));
    render(<flow.Page />);

    await click(buttonsNamed(flow.confirm)[0]);

    expect(alertBox()!.textContent).toContain("Check your connection and try again.");
    expect(buttonsNamed("Try again")).toHaveLength(1);
    // The button is not left stuck on "Submitting…".
    expect(useBookingStore.getState().isSubmitting).toBe(false);
    expect(buttonsNamed(flow.confirm)[0].disabled).toBe(false);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the service-unavailable screen when the database could not be reached", async () => {
    flow.submitMock.mockResolvedValue({
      success: false,
      error: "Something went wrong. Please try again.",
      unavailable: true,
    });
    render(<flow.Page />);

    await click(buttonsNamed(flow.confirm)[0]);

    const text = container.textContent ?? "";
    expect(container.querySelector("h1")!.textContent).toBe("Something went wrong");
    expect(text).toContain(`Your ${flow.subject} was NOT submitted.`);
    expect(buttonsNamed("Try Again")).toHaveLength(1);
    expect([...container.querySelectorAll("a")].some((a) => a.getAttribute("href") === "/")).toBe(
      true,
    );
    expect(telLinks()).toHaveLength(1);
    // The review content is replaced, but nothing the customer entered is lost.
    expect(text).not.toContain("Review");
    expect(useBookingStore.getState().name).toBe(flow.state.name);
    expect(useBookingStore.getState().address).toBe(flow.state.address);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("Try Again on the unavailable screen retries and continues on success", async () => {
    flow.submitMock
      .mockResolvedValueOnce({ success: false, error: "x", unavailable: true })
      .mockResolvedValueOnce(flow.successResult);
    render(<flow.Page />);
    await click(buttonsNamed(flow.confirm)[0]);

    await click(buttonsNamed("Try Again")[0]);

    expect(flow.submitMock).toHaveBeenCalledTimes(2);
    expect(pushMock).toHaveBeenCalledWith(flow.confirmationUrl);
  });

  it("stays on the unavailable screen when the retry fails the same way", async () => {
    flow.submitMock.mockResolvedValue({ success: false, error: "x", unavailable: true });
    render(<flow.Page />);
    await click(buttonsNamed(flow.confirm)[0]);

    await click(buttonsNamed("Try Again")[0]);

    expect(flow.submitMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector("h1")!.textContent).toBe("Something went wrong");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("never reports success without a reference", async () => {
    flow.submitMock.mockResolvedValue({ success: true });
    render(<flow.Page />);

    await click(buttonsNamed(flow.confirm)[0]);

    expect(pushMock).not.toHaveBeenCalled();
    expect(alertBox()!.textContent).toContain(flow.notSent);
  });
});

describe("residential review: saved state", () => {
  it("sends the customer to the date step when their saved date was cleared as expired", () => {
    useBookingStore.setState({ ...RESIDENTIAL, date: "", dateExpired: true });

    render(<ResidentialReview />);

    expect(replaceMock).toHaveBeenCalledWith("/residential/datetime?returnTo=review");
    expect(replaceMock).not.toHaveBeenCalledWith("/residential");
  });

  it("still sends an empty wizard back to the start", () => {
    render(<ResidentialReview />);

    expect(replaceMock).toHaveBeenCalledWith("/residential");
  });

  it("stays put when everything is filled in", () => {
    useBookingStore.setState(RESIDENTIAL);

    render(<ResidentialReview />);

    expect(replaceMock).not.toHaveBeenCalled();
  });
});
