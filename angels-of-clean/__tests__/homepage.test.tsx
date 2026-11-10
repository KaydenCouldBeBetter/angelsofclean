import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// next/link needs the App Router at runtime; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import MarketingLayout from "@/app/(marketing)/layout";
import Home from "@/app/(marketing)/page";
import { BUSINESS_PHONE } from "@/lib/constants";
import {
  HOMEPAGE_HERO_FACTS,
  HOMEPAGE_REVIEWS,
  HOMEPAGE_TRUST_BADGES,
  SERVICE_AREA_TOWNS,
  SITE_PHOTOS,
} from "@/lib/homepage-content";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <MarketingLayout>
        <Home />
      </MarketingLayout>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = () => container.textContent ?? "";
const links = () => [...container.querySelectorAll("a")];
const linksNamed = (name: string) => links().filter((a) => a.textContent?.replace(/\s+/g, " ").trim() === name);

describe("homepage (Figma Marketing — Home)", () => {
  it("has one h1, the Figma headline, and never skips a heading level", () => {
    const headings = [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")];
    const levels = headings.map((h) => Number(h.tagName[1]));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    expect(container.querySelector("h1")?.textContent).toBe("Pure Clean, Divinely Inspired");
    levels.slice(1).forEach((level, i) => {
      expect(level - levels[i], `heading "${headings[i + 1].textContent}"`).toBeLessThanOrEqual(1);
    });
  });

  it("shows the Figma sections in order", () => {
    const names = [...container.querySelectorAll("main h1, main h2")].map((h) => h.textContent);
    expect(names).toEqual([
      "Pure Clean, Divinely Inspired",
      "Our Services",
      "What Our Clients Say",
      "Ready for a Cleaner Home?",
    ]);
  });

  it("offers exactly the two booking paths, however many buttons lead to them", () => {
    const bookings = linksNamed("Book a cleaning");
    expect(bookings.length).toBeGreaterThanOrEqual(2);
    bookings.forEach((a) => expect(a.getAttribute("href")).toBe("/residential"));
    expect(linksNamed("Get a commercial quote")[0]?.getAttribute("href")).toBe("/commercial");
    expect(linksNamed("Commercial? Request a quote →")[0]?.getAttribute("href")).toBe("/commercial");
    expect(linksNamed("Get a Quote →")[0]?.getAttribute("href")).toBe("/commercial");
  });

  it("has a skip link, a header, one main landmark and a footer with the privacy and terms links", () => {
    expect(links()[0]?.getAttribute("href")).toBe("#main");
    expect(container.querySelector("main")?.id).toBe("main");
    expect(container.querySelectorAll("header")).toHaveLength(1);
    expect(container.querySelectorAll("main")).toHaveLength(1);
    const footer = container.querySelector("footer");
    expect(footer?.querySelector('a[href="/privacy"]')?.textContent).toBe("Privacy Policy");
    expect(footer?.querySelector('a[href="/terms"]')?.textContent).toBe("Terms of Service");
  });

  it("shows the business phone as a tel link and nothing for the admin", () => {
    expect(container.querySelector(`header a[href="${BUSINESS_PHONE.tel}"]`)).not.toBeNull();
    expect(container.querySelector(`footer a[href="${BUSINESS_PHONE.tel}"]`)).not.toBeNull();
    expect(links().some((a) => a.getAttribute("href")?.startsWith("/admin"))).toBe(false);
  });

  it("puts Get a commercial quote right after Book a cleaning in the header, so a business never lands in the home flow", () => {
    const header = container.querySelector("header")!;
    const named = (name: string) =>
      [...header.querySelectorAll("a")].filter((a) => a.textContent?.replace(/\s+/g, " ").trim() === name);

    // One in the desktop bar and one in the mobile menu, each beside its Book a cleaning.
    expect(named("Book a cleaning")).toHaveLength(2);
    expect(named("Get a commercial quote")).toHaveLength(2);
    named("Book a cleaning").forEach((book, i) => {
      const quote = named("Get a commercial quote")[i];
      expect(book.getAttribute("href")).toBe("/residential");
      expect(quote.getAttribute("href")).toBe("/commercial");
      expect(book.nextElementSibling).toBe(quote);
    });
  });

  it("links to customer login from the desktop bar and the mobile menu", () => {
    const login = [...container.querySelectorAll("header a")].filter((a) => a.textContent === "Log in");
    expect(login).toHaveLength(2);
    login.forEach((a) => expect(a.getAttribute("href")).toBe("/login"));
  });

  it("marks Home as the current page in the header", () => {
    const current = [...container.querySelectorAll('header [aria-current="page"]')];
    expect(current.map((a) => a.textContent)).toEqual(["Home", "Home"]);
  });

  it("names every town in the service area teaser and the footer", () => {
    const teaser = container.querySelector('section[aria-label="Service area"]')!;
    const footer = container.querySelector("footer")!;
    for (const { town } of SERVICE_AREA_TOWNS) {
      expect(teaser.textContent, town).toContain(town);
      expect(footer.textContent, town).toContain(town);
    }
    expect(teaser.querySelector('a[href="/areas"]')).not.toBeNull();
  });

  it("shows the hero claims and the four credentials", () => {
    const claims = [...container.querySelectorAll('ul[aria-label="Why customers trust us"] li')].map((li) => li.textContent);
    expect(claims).toEqual([...HOMEPAGE_HERO_FACTS]);
    const badges = container.querySelector('section[aria-label="Credentials"]')!;
    for (const badge of HOMEPAGE_TRUST_BADGES) {
      expect(badges.textContent).toContain(badge.label);
      expect(badges.textContent).toContain(badge.shortLabel);
    }
  });

  it("shows the three homepage reviews and not the fourth", () => {
    const shown = [...container.querySelectorAll('ul[aria-label="Customer reviews"] figure')].map(
      (f) => f.querySelector("figcaption")?.textContent?.replace("— ", "").trim(),
    );
    expect(shown).toEqual(HOMEPAGE_REVIEWS.filter((r) => r.onHomepage).map((r) => r.author));
    expect(text()).not.toContain("Michelle B.");
  });

  it("links the service cards to the Services page sections, the quote flow", () => {
    expect(linksNamed("See Residential Services →")[0]?.getAttribute("href")).toBe("/services#residential");
    expect(linksNamed("View All Services →")[0]?.getAttribute("href")).toBe("/services#specialty");
  });

  it("shows no prices", () => {
    expect(text()).not.toMatch(/\$\d/);
  });

  it("labels every placeholder on the page with a visible 'Placeholder' badge", () => {
    const badges = [...container.querySelectorAll("span")].filter((s) => s.textContent === "Placeholder");
    const flagged = (items: { placeholder: boolean }[]) => items.filter((i) => i.placeholder).length;
    const expected =
      flagged(HOMEPAGE_REVIEWS.filter((r) => r.onHomepage)) +
      flagged(HOMEPAGE_TRUST_BADGES) +
      (SITE_PHOTOS.hero.placeholder ? 1 : 0);
    expect(badges).toHaveLength(expected);
  });

  it("renders the hero photo as a labelled image, never an unlabelled one", () => {
    const hero = container.querySelector('section[aria-labelledby="hero-heading"]')!;
    const photos = hero.querySelectorAll('[role="img"], img');
    expect(photos).toHaveLength(1);
    expect(photos[0].getAttribute("aria-label") ?? photos[0].getAttribute("alt")).toBeTruthy();
  });

  it("gives every image a text alternative", () => {
    container.querySelectorAll("img").forEach((img) => {
      expect(img.getAttribute("alt")?.trim()).toBeTruthy();
    });
  });

  it("names every section with its heading or a label", () => {
    container.querySelectorAll("section").forEach((section) => {
      const labelledBy = section.getAttribute("aria-labelledby");
      if (labelledBy) {
        expect(container.querySelector(`#${labelledBy}`)?.textContent?.trim()).toBeTruthy();
      } else {
        expect(section.getAttribute("aria-label")?.trim()).toBeTruthy();
      }
    });
  });
});

describe("mobile menu", () => {
  const button = () => container.querySelector<HTMLButtonElement>('button[aria-controls="mobile-nav"]')!;
  const menu = () => container.querySelector<HTMLElement>("#mobile-nav")!;

  it("is closed to start with, opens from its button and closes on Escape with focus back on the button", () => {
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(menu().hidden).toBe(true);
    expect(button().textContent).toBe("Open menu");

    act(() => button().click());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(menu().hidden).toBe(false);
    expect(button().textContent).toBe("Close menu");
    expect([...menu().querySelectorAll("a")].map((a) => a.textContent)).toEqual([
      "Home",
      "Services",
      "About",
      "Areas & Reviews",
      BUSINESS_PHONE.display,
      "Log in",
      "Book a cleaning",
      "Get a commercial quote",
    ].map((t) => (t === BUSINESS_PHONE.display ? `Call us: ${t}` : t)));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(menu().hidden).toBe(true);
    expect(document.activeElement).toBe(button());
  });
});
