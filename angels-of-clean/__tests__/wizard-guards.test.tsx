import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

const replaceMock = vi.fn();
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

// next/link needs the App Router at runtime; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// The review steps import the server actions; nothing here submits.
vi.mock("@/app/actions/submitBooking", () => ({ submitBooking: vi.fn() }));
vi.mock("@/app/actions/submitCommercialQuote", () => ({ submitCommercialQuote: vi.fn() }));

import { useBookingStore } from "@/store/bookingStore";
import ResidentialAddress from "@/app/residential/address/page";
import ResidentialProperty from "@/app/residential/property/page";
import ResidentialDateTime from "@/app/residential/datetime/page";
import ResidentialContact from "@/app/residential/contact/page";
import ResidentialReview from "@/app/residential/review/page";
import CommercialServices from "@/app/commercial/services/page";
import CommercialContact from "@/app/commercial/contact/page";
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
  commercialNotes: "",
  name: "Dana Lee",
  businessName: "Northside Dental",
  email: "dana@example.com",
  phone: "(315) 555-0199",
  commercialFrequency: "weekly" as const,
  schedulePreference: "after" as const,
};

// Every step that redirects a visitor who arrives without the earlier steps.
const GUARDED_STEPS = [
  { name: "residential address", Page: ResidentialAddress, saved: RESIDENTIAL, start: "/residential" },
  { name: "residential property", Page: ResidentialProperty, saved: RESIDENTIAL, start: "/residential" },
  { name: "residential datetime", Page: ResidentialDateTime, saved: RESIDENTIAL, start: "/residential" },
  { name: "residential contact", Page: ResidentialContact, saved: RESIDENTIAL, start: "/residential" },
  { name: "residential review", Page: ResidentialReview, saved: RESIDENTIAL, start: "/residential" },
  { name: "commercial services", Page: CommercialServices, saved: COMMERCIAL, start: "/commercial" },
  { name: "commercial contact", Page: CommercialContact, saved: COMMERCIAL, start: "/commercial" },
  { name: "commercial review", Page: CommercialReview, saved: COMMERCIAL, start: "/commercial" },
];

let container: HTMLDivElement;
let root: Root | undefined;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  useBookingStore.getState().reset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (root) act(() => root!.unmount());
  container.remove();
});

describe.each(GUARDED_STEPS)("$name step guard", ({ Page, saved, start }) => {
  it("does not redirect when the booking is saved", () => {
    useBookingStore.setState(saved);
    root = createRoot(container);

    act(() => root!.render(<Page />));

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("does not redirect while React hydrates server HTML with a saved booking", () => {
    // Hydration is where Zustand serves its empty default state, which is what
    // used to send a refresh or a deep link back to step 1.
    useBookingStore.setState(saved);
    container.innerHTML = renderToString(<Page />);

    act(() => {
      root = hydrateRoot(container, <Page />);
    });

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("still redirects to step 1 when nothing is saved", () => {
    root = createRoot(container);

    act(() => root!.render(<Page />));

    expect(replaceMock).toHaveBeenCalledWith(start);
  });

  it("still redirects after hydrating server HTML with nothing saved", () => {
    container.innerHTML = renderToString(<Page />);

    act(() => {
      root = hydrateRoot(container, <Page />);
    });

    expect(replaceMock).toHaveBeenCalledWith(start);
  });
});

describe("guards before the store has rehydrated", () => {
  it("wait for rehydration to finish, then redirect on an empty store", () => {
    const { persist } = useBookingStore;
    vi.spyOn(persist, "hasHydrated").mockReturnValue(false);
    root = createRoot(container);

    act(() => root!.render(<ResidentialAddress />));
    expect(replaceMock).not.toHaveBeenCalled();

    vi.mocked(persist.hasHydrated).mockRestore();
    act(() => {
      void persist.rehydrate();
    });
    expect(replaceMock).toHaveBeenCalledWith("/residential");
  });

  it("wait for rehydration to finish, then stay put when a booking was saved", () => {
    const { persist } = useBookingStore;
    // What's in sessionStorage, but not yet in the store.
    useBookingStore.setState(RESIDENTIAL);
    const savedJson = sessionStorage.getItem("booking-store") ?? "";
    useBookingStore.getState().reset();
    vi.spyOn(persist, "hasHydrated").mockReturnValue(false);
    root = createRoot(container);

    act(() => root!.render(<ResidentialAddress />));
    expect(replaceMock).not.toHaveBeenCalled();

    vi.mocked(persist.hasHydrated).mockRestore();
    sessionStorage.setItem("booking-store", savedJson);
    act(() => {
      void persist.rehydrate();
    });
    expect(useBookingStore.getState().service).toBe("standard");
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
