import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// B38: the residential flow collects entry instructions on the property step,
// shows them on review and sends them with the booking, never in a URL.

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
import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import PropertyPage from "@/app/residential/property/page";
import ReviewPage from "@/app/residential/review/page";

const SECRET = "Side gate code 4412, the cat stays inside";

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

function typeInto(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
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

describe("property step", () => {
  function field() {
    return container.querySelector<HTMLTextAreaElement>("#access-instructions")!;
  }

  it("has a labelled, optional entry-instructions field with its hint", () => {
    useBookingStore.setState(RESIDENTIAL);
    render(<PropertyPage />);

    const label = container.querySelector('label[for="access-instructions"]');
    expect(label?.textContent).toBe("Entry instructions (optional)");
    const hint = document.getElementById(field().getAttribute("aria-describedby")!);
    expect(hint?.textContent).toContain("Door code, gate, pets.");
    expect(field().required).toBe(false);
    expect(field().maxLength).toBe(FIELD_MAX_LENGTHS.accessInstructions);
    // Keeps codes away from autofill history and browser spell-check services.
    expect(field().getAttribute("autocomplete")).toBe("off");
    expect(field().getAttribute("spellcheck")).toBe("false");
  });

  it("stores them apart from the notes on Next", () => {
    useBookingStore.setState(RESIDENTIAL);
    render(<PropertyPage />);

    typeInto(container.querySelector<HTMLTextAreaElement>("#notes")!, "Skip the basement");
    typeInto(field(), SECRET);
    clickButton(/^Next/);

    const state = useBookingStore.getState();
    expect(state.notes).toBe("Skip the basement");
    expect(state.accessInstructions).toBe(SECRET);
    expect(pushMock).toHaveBeenCalledWith("/residential/datetime");
  });

  it("refills them when the customer comes back to the step", () => {
    useBookingStore.setState({ ...RESIDENTIAL, accessInstructions: SECRET });
    render(<PropertyPage />);

    expect(field().value).toBe(SECRET);
  });
});

describe("review step", () => {
  it("shows them and sends them with the booking, but never in the URL", async () => {
    submitBookingMock.mockResolvedValue({ success: true, bookingRef: "AOC-1042", bookingId: "b-1" });
    useBookingStore.setState({
      ...RESIDENTIAL,
      accessInstructions: SECRET,
      formStartedAt: Date.now() - 90_000,
    });
    render(<ReviewPage />);

    expect(container.textContent).toContain(`Entry instructions: ${SECRET}`);

    await act(async () => clickButton(/^Confirm Booking/));

    expect(submitBookingMock).toHaveBeenCalledTimes(1);
    const [data] = submitBookingMock.mock.calls[0];
    expect(data.accessInstructions).toBe(SECRET);
    expect(data.notes).toBe("");
    expect(pushMock).toHaveBeenCalledWith("/residential/confirmation?ref=AOC-1042");
    expect(JSON.stringify(pushMock.mock.calls)).not.toContain("4412");
  });

  it("leaves the line out when none were given", () => {
    useBookingStore.setState({ ...RESIDENTIAL, formStartedAt: Date.now() });
    render(<ReviewPage />);

    expect(container.textContent).not.toContain("Entry instructions");
  });
});
