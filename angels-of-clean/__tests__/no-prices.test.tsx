import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";

// B28: no prices anywhere in the customer flow. The office confirms the price
// after reviewing each booking, and every review/confirmation page says so.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("ref=REF-1"),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("@/app/actions/submitBooking", () => ({ submitBooking: vi.fn() }));
vi.mock("@/app/actions/submitCommercialQuote", () => ({ submitCommercialQuote: vi.fn() }));

import { useBookingStore } from "@/store/bookingStore";
import { BUSINESS_PHONE, PRICE_NOTE } from "@/lib/constants";
import ResidentialPage from "@/app/residential/page";
import ResidentialReview from "@/app/residential/review/page";
import ResidentialConfirmation from "@/app/residential/confirmation/page";
import CommercialReview from "@/app/commercial/review/page";
import CommercialConfirmation from "@/app/commercial/confirmation/page";

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
  formStartedAt: Date.now() - 60_000,
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
  formStartedAt: Date.now() - 60_000,
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useBookingStore.getState().reset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("What happens next block", () => {
  it.each([
    ["residential review", ResidentialReview, RESIDENTIAL],
    ["residential confirmation", ResidentialConfirmation, RESIDENTIAL],
    ["commercial review", CommercialReview, COMMERCIAL],
    ["commercial confirmation", CommercialConfirmation, COMMERCIAL],
  ])("renders on %s", (_name, Page, state) => {
    useBookingStore.setState(state);
    act(() => root.render(<Page />));

    const blocks = container.querySelectorAll('[data-testid="what-happens-next"]');
    expect(blocks.length).toBeGreaterThan(0);
    const text = blocks[0].textContent ?? "";
    expect(text).toContain("What happens next");
    expect(text).toContain("confirm the price and time");
    expect(text).toContain("No payment is taken online");
    expect(text).toContain(BUSINESS_PHONE.display);
    expect(blocks[0].querySelector(`a[href="${BUSINESS_PHONE.tel}"]`)).not.toBeNull();
  });
});

describe("customer pages show no prices", () => {
  it("residential step 1 shows the price note and no dollar amounts", () => {
    act(() => root.render(<ResidentialPage />));
    const text = container.textContent ?? "";
    expect(text).toContain(PRICE_NOTE);
    expect(text).not.toMatch(/\$\s?\d/);
  });

  it.each([
    ["residential review", ResidentialReview, RESIDENTIAL],
    ["commercial review", CommercialReview, COMMERCIAL],
  ])("%s shows the price note and no dollar amounts", (_name, Page, state) => {
    useBookingStore.setState(state);
    act(() => root.render(<Page />));
    const text = container.textContent ?? "";
    expect(text).toContain(PRICE_NOTE);
    expect(text).not.toMatch(/\$\s?\d/);
  });
});

describe("source scan", () => {
  const ROOT = path.resolve(__dirname, "..");
  const FILES = [
    "lib/constants.ts",
    "app/residential/page.tsx",
    "app/residential/review/page.tsx",
    "app/residential/confirmation/page.tsx",
    "app/commercial/review/page.tsx",
    "app/commercial/confirmation/page.tsx",
    "components/booking/BookingSummary.tsx",
    "components/booking/WhatHappensNext.tsx",
    "app/terms/page.tsx",
  ];

  it.each(FILES)("%s has no $ price strings or price wording", (file) => {
    const src = fs.readFileSync(path.join(ROOT, file), "utf-8");
    // "$" followed by a digit, but not a template-literal "${".
    expect(src).not.toMatch(/\$\s?\d/);
    expect(src).not.toMatch(/starting at|PRICE_MAP|Estimated Price/i);
  });
});
