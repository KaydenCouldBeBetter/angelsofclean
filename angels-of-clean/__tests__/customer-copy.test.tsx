import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import fs from "fs";
import path from "path";

// Wave 10C: the customer-facing copy and controls from verification pass #2.
// Residential confirmation (findings 3, 19, 20), Log In / Create Account
// (9), phone-link names (6), commercial back link (10), ?ref= (13), the
// shared label sources (14), Lucide icons (21) and the 44px chips (23).

const nav = vi.hoisted(() => ({ ref: null as string | null, replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  useSearchParams: () => new URLSearchParams(nav.ref === null ? "" : `ref=${nav.ref}`),
}));
// next/link needs the App Router at runtime; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { useBookingStore } from "@/store/bookingStore";
import { BUSINESS_PHONE, PRICE_NOTE } from "@/lib/constants";
import DesktopNavbar from "@/components/booking/DesktopNavbar";
import ResidentialPage from "@/app/residential/page";
import ResidentialConfirmation from "@/app/residential/confirmation/page";
import CommercialStep1 from "@/app/commercial/page";
import CommercialConfirmation from "@/app/commercial/confirmation/page";
import CommercialError from "@/app/commercial/error/page";

const RESIDENTIAL = {
  service: "standard" as const,
  frequency: "one-time" as const,
  address: "1 Test St",
  city: "Cicero",
  zip: "13039",
  bedrooms: 3,
  bathrooms: 2.5,
  notes: "",
  // A Monday; the page must show it as one in every time zone.
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

let container: HTMLDivElement;
let root: Root;

function render(element: React.ReactElement) {
  act(() => root.render(element));
  return container.textContent ?? "";
}

function occurrences(text: string, part: string): number {
  return text.split(part).length - 1;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  nav.ref = null;
  useBookingStore.getState().reset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("residential confirmation copy (finding 3)", () => {
  beforeEach(() => {
    useBookingStore.setState(RESIDENTIAL);
    nav.ref = "AOC-1043";
  });

  it("says the request was received, in both layouts, and never that it is confirmed or emailed", () => {
    const text = render(<ResidentialConfirmation />);

    const headings = [...container.querySelectorAll("h1")].map((h) => h.textContent);
    expect(headings).toEqual(["Booking request received", "Booking request received"]);
    expect(occurrences(text, "We'll review your request and confirm the time and price with you.")).toBe(2);

    for (const claim of [
      "Booking Confirmed",
      "You're booked",
      "has been scheduled",
      "send a confirmation",
      "sent a confirmation",
      "jane@example.com",
    ]) {
      expect(text).not.toContain(claim);
    }
    // The check mark's own label must not claim it either.
    const icons = [...container.querySelectorAll('[role="img"]')].map((e) => e.getAttribute("aria-label"));
    expect(icons).toEqual(["Booking request received", "Booking request received"]);
  });

  it("shows PRICE_NOTE on both layouts", () => {
    const text = render(<ResidentialConfirmation />);
    expect(occurrences(text, PRICE_NOTE)).toBe(2);
  });

  it("labels the number 'Reference number' and offers 'Return to Home' on both layouts", () => {
    const text = render(<ResidentialConfirmation />);
    expect(occurrences(text, "Reference number: AOC-1043")).toBe(2);
    expect(text).not.toContain("Confirmation #");
    const buttons = [...container.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons.filter((t) => t === "Return to Home")).toHaveLength(2);
    expect(text).not.toContain("Return to Homepage");
  });

  it("shows bedrooms and bathrooms on the mobile card too (finding 19)", () => {
    render(<ResidentialConfirmation />);
    const mobile = container.querySelector(".lg\\:hidden")!;
    const desktop = container.querySelector(".hidden.lg\\:flex")!;
    expect(mobile.textContent).toContain("3 Bedrooms · 2.5 Bathrooms");
    expect(desktop.textContent).toContain("3 Bedrooms · 2.5 Bathrooms");
  });

  it("shows the booking date as the New York day, in both layouts (finding 12)", () => {
    const text = render(<ResidentialConfirmation />);
    expect(occurrences(text, "Monday, November 2, 2026")).toBe(2);
  });

  it("turns Create Account into a disabled 'Coming soon' button in both copies (finding 9)", () => {
    render(<ResidentialConfirmation />);
    const buttons = [...container.querySelectorAll("button")].filter((b) =>
      b.textContent?.includes("Create Account"),
    );
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain("Coming soon");
    }
  });
});

describe("the reload view (finding 3)", () => {
  it.each([
    ["residential", <ResidentialConfirmation key="r" />, "AOC-1043", "Booking request received"],
    ["commercial", <CommercialConfirmation key="c" />, "COM-1007", "Quote request submitted!"],
  ])("%s keeps the next steps and the phone number", (_name, page, ref, title) => {
    nav.ref = ref;
    const text = render(page);

    expect(text).toContain(title);
    expect(text).toContain(`Reference number: ${ref}`);
    const block = container.querySelector('[data-testid="what-happens-next"]');
    expect(block).not.toBeNull();
    expect(block!.textContent).toContain("What happens next");
    expect(block!.querySelector(`a[href="${BUSINESS_PHONE.tel}"]`)!.textContent).toBe(
      BUSINESS_PHONE.display,
    );
  });
});

describe("?ref= is accepted only in the shape the server issues (finding 13)", () => {
  it.each([
    "anything",
    "AOC-",
    "aoc-1043",
    "AOC-1043 ",
    "AOC-1043\n",
    "AOC-10x",
    "COM-1007",
    "<b>AOC-1043</b>",
    "Call 555-0100 to claim your prize",
  ])("residential: %j is treated as no reference", (bad) => {
    nav.ref = bad;
    const text = render(<ResidentialConfirmation />);

    expect(text).toBe("");
    expect(nav.replace).toHaveBeenCalledWith("/residential");
  });

  it("residential: a real booking with a bad reference shows the booking but no reference", () => {
    useBookingStore.setState(RESIDENTIAL);
    nav.ref = "Call 555-0100 to claim your prize";
    const text = render(<ResidentialConfirmation />);

    expect(text).toContain("Booking request received");
    expect(text).not.toContain("Reference number");
    expect(text).not.toContain("claim your prize");
  });

  it.each(["anything", "COM-", "com-1007", "COM-1007 ", "AOC-1043", "COM-1; DROP TABLE"])(
    "commercial: %j is treated as no reference",
    (bad) => {
      useBookingStore.setState(COMMERCIAL);
      nav.ref = bad;
      const text = render(<CommercialConfirmation />);

      expect(text).toBe("");
      expect(nav.replace).toHaveBeenCalledWith("/commercial");
    },
  );
});

describe("Log In (finding 9)", () => {
  it("is a disabled 'Coming soon' button in the desktop navbar", () => {
    render(<DesktopNavbar />);
    const button = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Log In"),
    );
    expect(button).toBeDefined();
    expect(button!.disabled).toBe(true);
    expect(button!.textContent).toContain("Coming soon");
  });
});

describe("phone links keep the visible text in their name (finding 6)", () => {
  it("commercial step 1, confirmation and error pages have no aria-label on the phone link", () => {
    // Every phone link on the page (the navbar's too), and the visible text of
    // the page's own link, which must be in its name.
    const pages: [string, React.ReactElement, string][] = [
      ["step 1", <CommercialStep1 key="s" />, "Call us"],
      ["confirmation", <CommercialConfirmation key="c" />, BUSINESS_PHONE.display],
      ["error", <CommercialError key="e" />, BUSINESS_PHONE.display],
    ];
    for (const [name, page, visible] of pages) {
      useBookingStore.setState(COMMERCIAL);
      nav.ref = "COM-1007";
      render(page);
      const links = [...container.querySelectorAll(`a[href="${BUSINESS_PHONE.tel}"]`)];
      expect(links.map((l) => l.textContent), name).toContain(visible);
      for (const link of links) expect(link.hasAttribute("aria-label"), name).toBe(false);
      act(() => root.render(<div />));
    }
  });

  it("no source file labels a phone link 'Call Angels of Clean'", () => {
    const offenders = sourceFiles(["app", "components"]).filter((f) =>
      /aria-label=["']Call Angels of Clean["']/.test(fs.readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

describe("commercial step 1 back link (finding 10)", () => {
  it("reads '← Back to Home' and goes to /", () => {
    render(<CommercialStep1 />);
    const link = [...container.querySelectorAll("a")].find((a) =>
      a.textContent?.includes("Back to"),
    );
    expect(link!.textContent).toBe("← Back to Home");
    expect(link!.getAttribute("href")).toBe("/");
  });
});

describe("commercial confirmation copy (finding 20)", () => {
  it("uses 'Reference number' and 'Return to Home'", () => {
    useBookingStore.setState(COMMERCIAL);
    nav.ref = "COM-1007";
    const text = render(<CommercialConfirmation />);

    expect(text).toContain("Reference number: COM-1007");
    expect(text).not.toContain("Reference: COM");
    const buttons = [...container.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons).toContain("Return to Home");
    expect(text).not.toContain("Return to Homepage");
  });
});

describe("Lucide icons instead of emoji (finding 21)", () => {
  it.each([
    ["confirmation", <CommercialConfirmation key="c" />],
    ["error", <CommercialError key="e" />],
  ])("commercial %s has no emoji, and its icons are hidden from assistive tech", (_n, page) => {
    useBookingStore.setState(COMMERCIAL);
    nav.ref = "COM-1007";
    const text = render(page);

    expect(text).not.toMatch(EMOJI);
    const icons = container.querySelectorAll("svg.lucide");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("no customer-facing source file contains an emoji", () => {
    const offenders = sourceFiles(["app/commercial", "app/residential", "components/booking", "components/home"])
      .filter((f) => EMOJI.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});

describe("mobile frequency chips (finding 23)", () => {
  it("are at least 44px tall (min-h-11)", () => {
    render(<ResidentialPage />);
    const group = container.querySelector('[role="radiogroup"][aria-label="Cleaning frequency"]')!;
    const chips = [...group.querySelectorAll("label")];
    expect(chips).toHaveLength(4);
    for (const chip of chips) expect(chip.className).toContain("min-h-11");
  });
});

describe("one source for service and frequency labels (finding 14)", () => {
  it.each([
    "components/booking/BookingSummary.tsx",
    "components/home/Services.tsx",
    "app/residential/page.tsx",
    "app/actions/submitBooking.ts",
  ])("%s does not retype them", (file) => {
    const src = fs.readFileSync(path.join(ROOT, file), "utf8");
    for (const label of ["Standard Clean", "Deep Clean", "Move-In / Move-Out", "Bi-weekly", "One-time"]) {
      expect(src, `${label} in ${file}`).not.toContain(label);
    }
    expect(src).toContain("@/lib/constants");
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
// Pictographs, dingbats and the "information" sign (ℹ), but not the arrows,
// check marks and dashes the pages use as plain text.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2139}\u{FE0F}]/u;

function sourceFiles(dirs: string[]): string[] {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name === "__tests__" || entry.name === "node_modules" ? [] : walk(full);
      }
      return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });
  return dirs.flatMap((d) => walk(path.join(ROOT, d)));
}
