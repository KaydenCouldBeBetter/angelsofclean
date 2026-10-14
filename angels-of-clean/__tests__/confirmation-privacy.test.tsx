import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const replaceMock = vi.fn();
const pushMock = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => searchParams,
}));

// next/link needs the App Router at runtime; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { useBookingStore } from "@/store/bookingStore";
import ResidentialConfirmation from "@/app/residential/confirmation/page";
import CommercialConfirmation from "@/app/commercial/confirmation/page";

const RESIDENTIAL = {
  service: "standard" as const,
  frequency: "one-time" as const,
  address: "1 Test St",
  city: "Cicero",
  zip: "13039",
  bedrooms: 2,
  bathrooms: 1,
  notes: "Key under the mat",
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
  floors: 3,
  serviceAreas: ["lobbies"],
  commercialNotes: "Badge access after 6",
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
  return container.textContent ?? "";
}

function storedBooking(): string {
  return sessionStorage.getItem("booking-store") ?? "";
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  useBookingStore.getState().reset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("residential confirmation", () => {
  it("shows the booking, then clears it from the store and sessionStorage", () => {
    useBookingStore.setState(RESIDENTIAL);
    searchParams = new URLSearchParams("ref=AOC-1043");
    expect(storedBooking()).toContain("jane@example.com");

    const text = render(<ResidentialConfirmation />);

    expect(text).toContain("AOC-1043");
    expect(text).toContain("jane@example.com");
    expect(text).toContain("1 Test St");
    expect(useBookingStore.getState().email).toBe("");
    expect(useBookingStore.getState().address).toBe("");
    for (const secret of ["jane@example.com", "1 Test St", "555-0100", "Key under the mat"]) {
      expect(storedBooking()).not.toContain(secret);
    }
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("still shows the confirmation number after a reload has nothing left to show", () => {
    searchParams = new URLSearchParams("ref=AOC-1043");

    const text = render(<ResidentialConfirmation />);

    expect(text).toContain("You're booked!");
    expect(text).toContain("Confirmation # AOC-1043");
    expect(text).toContain("no longer stored in this browser");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("sends a visitor with no booking and no reference back to step 1", () => {
    const text = render(<ResidentialConfirmation />);

    expect(text).toBe("");
    expect(replaceMock).toHaveBeenCalledWith("/residential");
  });
});

describe("commercial confirmation", () => {
  it("shows the request, then clears it from the store and sessionStorage", () => {
    useBookingStore.setState(COMMERCIAL);
    searchParams = new URLSearchParams("ref=COM-1007");
    expect(storedBooking()).toContain("dana@example.com");

    const text = render(<CommercialConfirmation />);

    expect(text).toContain("COM-1007");
    expect(text).toContain("Northside Dental");
    expect(useBookingStore.getState().businessName).toBe("");
    for (const secret of ["dana@example.com", "Northside Dental", "555-0199", "100 Clinton Sq"]) {
      expect(storedBooking()).not.toContain(secret);
    }
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("still shows the reference after a reload has nothing left to show", () => {
    searchParams = new URLSearchParams("ref=COM-1007");

    const text = render(<CommercialConfirmation />);

    expect(text).toContain("Quote request submitted!");
    expect(text).toContain("Reference: COM-1007");
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("sends a visitor without a reference back to step 1", () => {
    useBookingStore.setState(COMMERCIAL);

    const text = render(<CommercialConfirmation />);

    expect(text).toBe("");
    expect(replaceMock).toHaveBeenCalledWith("/commercial");
  });
});
