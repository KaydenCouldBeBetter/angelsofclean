import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// next/link needs the App Router at runtime; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { LEGAL_INFO, isLegalDraft, missingLegalFields, type LegalInfo } from "@/lib/legal";
import LegalPage, { ContactLines, LegalValue } from "@/components/legal/LegalPage";
import { AgreementNote, PrivacyNote } from "@/components/booking/PolicyNotes";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import ResidentialContact from "@/app/residential/contact/page";
import { useBookingStore } from "@/store/bookingStore";

const FILLED: LegalInfo = {
  legalName: "Angels of Clean LLC",
  mailingAddress: "1 Main St, Syracuse, NY 13202",
  contactEmail: "hello@example.com",
  contactPhone: "(315) 555-0123",
  effectiveDate: "November 1, 2026",
  recordRetention: "three years",
  cancellationPolicy: "Cancel up to 24 hours before at no charge.",
  paymentTerms: "Pay after your cleaning.",
  damagePolicy: "Tell us within 24 hours.",
  reviewed: true,
};

let container: HTMLDivElement;
let root: Root;

function render(element: React.ReactElement) {
  act(() => root.render(element));
  return container.textContent ?? "";
}

function hrefs(): string[] {
  return Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
}

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

describe("legal draft state", () => {
  it("is a draft while any value is missing, even if marked reviewed", () => {
    expect(isLegalDraft({ ...FILLED, contactEmail: null })).toBe(true);
    expect(missingLegalFields({ ...FILLED, contactEmail: null })).toEqual(["contact email"]);
  });

  it("treats blank values as missing", () => {
    expect(missingLegalFields({ ...FILLED, paymentTerms: "   " })).toEqual(["payment terms"]);
  });

  it("is a draft until reviewed, even with every value filled in", () => {
    expect(isLegalDraft({ ...FILLED, reviewed: false })).toBe(true);
    expect(isLegalDraft(FILLED)).toBe(false);
  });

  it("is still a draft in the repo, since the owner hasn't supplied the details", () => {
    expect(isLegalDraft(LEGAL_INFO)).toBe(true);
  });
});

describe("legal pages", () => {
  it("privacy policy renders with a draft banner and visible placeholders", () => {
    const text = render(<PrivacyPage />);
    expect(container.querySelector("h1")?.textContent).toBe("Privacy Policy");
    expect(text).toContain("Draft — not yet in effect");
    expect(text).toContain("[To be provided: contact email]");
    expect(text).toContain("[To be provided: how long records are kept]");
    expect(hrefs()).toContain("/terms");
  });

  it("privacy policy doesn't repeat the inaccurate no-third-parties promise", () => {
    const text = render(<PrivacyPage />);
    expect(text).not.toMatch(/never share/i);
    expect(text).toContain("Supabase");
  });

  it("privacy policy says Add to Google Calendar sends the booking to Google, and the Apple file doesn't", () => {
    const text = render(<PrivacyPage />);
    expect(text).toContain("Add to Google Calendar");
    expect(text).toMatch(/date, time and address to Google/);
    expect(text).toMatch(/Apple Calendar file is saved on your device/);
  });

  it("terms of service renders with a draft banner and links to the privacy policy", () => {
    const text = render(<TermsPage />);
    expect(container.querySelector("h1")?.textContent).toBe("Terms of Service");
    expect(text).toContain("Draft — not yet in effect");
    expect(text).toContain("[To be provided: cancellation and rescheduling policy]");
    expect(hrefs()).toContain("/privacy");
  });

  it("drops the banner and placeholders once everything is filled in and reviewed", () => {
    const text = render(
      <LegalPage title="Privacy Policy" info={FILLED}>
        <LegalValue field="legalName" info={FILLED} />
        <ContactLines info={FILLED} />
      </LegalPage>
    );
    expect(text).not.toContain("Draft");
    expect(text).not.toContain("To be provided");
    expect(text).toContain("Effective date: November 1, 2026");
    expect(text).toContain("Angels of Clean LLC");
    expect(hrefs()).toContain("mailto:hello@example.com");
    expect(hrefs()).toContain("tel:3155550123");
  });
});

describe("booking flow notes", () => {
  it("privacy note links to the privacy policy", () => {
    render(<PrivacyNote />);
    expect(hrefs()).toEqual(["/privacy"]);
  });

  it("agreement note names the button and links to both documents", () => {
    const text = render(<AgreementNote action="Confirm Booking" />);
    expect(text).toContain("By selecting Confirm Booking, you agree to our Terms of Service");
    expect(hrefs()).toEqual(["/terms", "/privacy"]);
  });

  it("residential contact step shows the privacy note instead of the old promise", () => {
    useBookingStore.setState({ date: "2026-11-02" });
    const text = render(<ResidentialContact />);
    expect(text).not.toMatch(/never share/i);
    expect(hrefs()).toContain("/privacy");
  });
});
