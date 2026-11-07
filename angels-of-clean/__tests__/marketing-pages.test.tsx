import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import fs from "fs";
import path from "path";
import { createRoot, type Root } from "react-dom/client";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import MarketingLayout from "@/app/(marketing)/layout";
import Home from "@/app/(marketing)/page";
import ServicesPage from "@/app/(marketing)/services/page";
import AboutPage from "@/app/(marketing)/about/page";
import AreasPage from "@/app/(marketing)/areas/page";
import { BUSINESS_EMAIL, BUSINESS_HOURS, BUSINESS_PHONE } from "@/lib/constants";
import {
  HOMEPAGE_REVIEWS,
  SERVICE_AREA_MAP,
  SERVICE_AREA_TOWNS,
  SITE_PHOTOS,
  TEAM_MEMBERS,
} from "@/lib/homepage-content";
import {
  AHCA_TRAINING,
  COMMERCIAL_OFFERINGS,
  FOOTER_LINKS,
  NAV_LINKS,
  RESIDENTIAL_OFFERINGS,
  SPECIALTY_OFFERINGS,
} from "@/lib/site-content";

const PAGES: Record<string, () => React.JSX.Element> = {
  "/": Home,
  "/services": ServicesPage,
  "/about": AboutPage,
  "/areas": AreasPage,
};

let container: HTMLDivElement;
let root: Root;

function render(pathname: string) {
  nav.pathname = pathname;
  const Page = PAGES[pathname];
  act(() =>
    root.render(
      <MarketingLayout>
        <Page />
      </MarketingLayout>,
    ),
  );
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const main = () => container.querySelector("main")!;
const mainLinks = () => [...main().querySelectorAll("a")];
const headings = (selector: string) => [...main().querySelectorAll(selector)].map((h) => h.textContent);
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

describe("every marketing page", () => {
  it.each(Object.keys(PAGES))("%s has one h1, no skipped heading level, one main and named sections", (pathname) => {
    render(pathname);
    const hs = [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")];
    const levels = hs.map((h) => Number(h.tagName[1]));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    levels.slice(1).forEach((level, i) => {
      expect(level - levels[i], `${pathname}: "${hs[i + 1].textContent}"`).toBeLessThanOrEqual(1);
    });
    expect(container.querySelectorAll("main")).toHaveLength(1);
    container.querySelectorAll("section").forEach((section) => {
      const labelledBy = section.getAttribute("aria-labelledby");
      const name = labelledBy ? container.querySelector(`#${labelledBy}`)?.textContent : section.getAttribute("aria-label");
      expect(name?.trim(), `${pathname}: unnamed section`).toBeTruthy();
    });
  });

  it.each(Object.keys(PAGES))("%s shows no prices and no admin link", (pathname) => {
    render(pathname);
    expect(container.textContent).not.toMatch(/\$\d/);
    expect([...container.querySelectorAll("a")].some((a) => a.getAttribute("href")?.startsWith("/admin"))).toBe(false);
  });

  it.each(Object.keys(PAGES))("%s: every image has a text alternative and every icon is hidden from screen readers", (pathname) => {
    render(pathname);
    container.querySelectorAll("img").forEach((img) => expect(img.getAttribute("alt")?.trim()).toBeTruthy());
    container.querySelectorAll("svg.lucide").forEach((icon) => expect(icon.getAttribute("aria-hidden")).toBe("true"));
  });

  it("marks the current page in the header navigation", () => {
    for (const link of NAV_LINKS) {
      render(link.href);
      const current = [...container.querySelectorAll('header nav[aria-label="Main"] [aria-current="page"]')];
      expect(current.map((a) => a.textContent), link.href).toEqual([link.label]);
    }
  });

  it.each(Object.keys(PAGES))("%s header offers both booking paths, commercial beside residential", (pathname) => {
    render(pathname);
    const bar = container.querySelector('header div.lg\\:flex a[href="/residential"]')!;
    expect(clean(bar.textContent)).toBe("Book a cleaning");
    expect(clean(bar.nextElementSibling?.textContent)).toBe("Get a commercial quote");
    expect(bar.nextElementSibling?.getAttribute("href")).toBe("/commercial");
  });
});

describe("navigation never leads to a page that isn't there", () => {
  const appDir = path.resolve(__dirname, "..", "app", "(marketing)");
  const pageFile = (pathname: string) => path.join(appDir, pathname === "/" ? "" : pathname, "page.tsx");

  it.each([...NAV_LINKS, ...FOOTER_LINKS].map((l) => l.href.split("#")[0]))("%s has a page", (pathname) => {
    expect(fs.existsSync(pageFile(pathname)), pathname).toBe(true);
  });

  it("every in-site link with a #fragment lands on an element with that id", () => {
    const targets = new Map<string, Set<string>>();
    const found: { from: string; href: string }[] = [];
    for (const pathname of Object.keys(PAGES)) {
      render(pathname);
      targets.set(pathname, new Set([...container.querySelectorAll("[id]")].map((el) => el.id)));
      container.querySelectorAll("a").forEach((a) => {
        const href = a.getAttribute("href") ?? "";
        if (href.includes("#") && !href.startsWith("#")) found.push({ from: pathname, href });
      });
    }
    expect(found.length).toBeGreaterThan(0);
    for (const { from, href } of found) {
      const [pathname, id] = href.split("#");
      expect(targets.get(pathname)?.has(id), `${from} links to ${href}`).toBe(true);
    }
  });

  it("every internal link is one of the pages, the two booking paths, or the legal pages", () => {
    const allowed = new Set([...Object.keys(PAGES), "/residential", "/commercial", "/privacy", "/terms"]);
    for (const pathname of Object.keys(PAGES)) {
      render(pathname);
      container.querySelectorAll("a").forEach((a) => {
        const href = a.getAttribute("href") ?? "";
        if (!href.startsWith("/")) return;
        expect(allowed.has(href.split("#")[0]), `${pathname} links to ${href}`).toBe(true);
      });
    }
  });
});

describe("footer", () => {
  it("lists the quick links, every town, the contact details and the hours", () => {
    render("/");
    const footer = container.querySelector("footer")!;
    const quick = [...footer.querySelectorAll('nav[aria-labelledby="footer-quick-links"] a')];
    expect(quick.map((a) => [a.textContent, a.getAttribute("href")])).toEqual(FOOTER_LINKS.map((l) => [l.label, l.href]));
    for (const { town } of SERVICE_AREA_TOWNS) expect(footer.textContent).toContain(town);
    expect(footer.querySelector(`a[href="${BUSINESS_PHONE.tel}"]`)).not.toBeNull();
    expect(footer.querySelectorAll(`a[href="mailto:${BUSINESS_EMAIL}"]`).length).toBeGreaterThanOrEqual(1);
    for (const line of BUSINESS_HOURS) expect(footer.textContent).toContain(line);
  });

  it("opens the Facebook page in a new tab and says so", () => {
    render("/");
    const facebook = [...container.querySelectorAll("footer a")].find((a) => a.textContent?.startsWith("Facebook"))!;
    expect(facebook.getAttribute("href")).toMatch(/^https:\/\/www\.facebook\.com\//);
    expect(facebook.getAttribute("target")).toBe("_blank");
    expect(facebook.getAttribute("rel")).toContain("noopener");
    expect(facebook.textContent).toContain("opens in a new tab");
  });
});

describe("Services page (Figma Marketing — Services)", () => {
  beforeEach(() => render("/services"));

  it("has the Figma heading and the three groups, in order", () => {
    expect(headings("h1")).toEqual(["Our Cleaning Services"]);
    expect(headings("h2")).toEqual([
      "Residential Cleaning",
      "Ready to Book?",
      "Commercial Cleaning",
      "Need a Custom Quote?",
      "Specialty Services",
      "Interested in Specialty Services?",
    ]);
  });

  it("shows every offering as a card that says Custom Quote and has a way forward", () => {
    const all = [...RESIDENTIAL_OFFERINGS, ...COMMERCIAL_OFFERINGS, ...SPECIALTY_OFFERINGS];
    expect(headings("h3")).toEqual(all.map((o) => o.title));
    expect(all).toHaveLength(11);
    expect(main().textContent?.match(/Custom Quote(?!\?)/g)).toHaveLength(all.length);
    for (const offering of all) {
      const link = mainLinks().find((a) => clean(a.textContent) === `${offering.cta.label} →`
        && a.closest("div")?.querySelector("h3")?.textContent === offering.title);
      expect(link?.getAttribute("href"), offering.title).toBe(offering.cta.href);
    }
  });

  it("books residential jobs, quotes commercial ones, and sends estimates to the contact section", () => {
    for (const o of RESIDENTIAL_OFFERINGS.slice(0, 3)) expect(o.cta.href).toBe("/residential");
    for (const o of COMMERCIAL_OFFERINGS) expect(o.cta.href).toBe("/commercial");
    for (const o of [...RESIDENTIAL_OFFERINGS.slice(3), ...SPECIALTY_OFFERINGS]) expect(o.cta.href).toBe("/areas#contact");
  });

  it("has anchors for the sections the homepage links to", () => {
    expect(container.querySelector("#residential")).not.toBeNull();
    expect(container.querySelector("#specialty")).not.toBeNull();
  });
});

describe("About page (Figma Marketing — About)", () => {
  beforeEach(() => render("/about"));

  it("has the Figma headings in order", () => {
    expect(headings("h1")).toEqual(["Cleaning with Intention"]);
    expect(headings("h2")).toEqual([
      "AHCA Certified Professionals",
      "Meet the Team",
      "How We Make Sure Things Go Right",
      "Ready to Experience the Difference?",
    ]);
    expect(headings("h3")).toEqual(["Training and education", "Quality, skilled individuals", "Top-notch customer service"]);
  });

  it("lists what AHCA training covers and the membership badge", () => {
    const text = main().textContent!;
    for (const item of AHCA_TRAINING) expect(text).toContain(item);
    expect(text).toContain("Member in Good Standing — AHCA");
  });

  it("shows four labelled team members and flags every placeholder", () => {
    const team = main().querySelector('ul[aria-label="Team members"]')!;
    expect(team.querySelectorAll("li")).toHaveLength(TEAM_MEMBERS.length);
    team.querySelectorAll('[role="img"], img').forEach((photo) => {
      expect(photo.getAttribute("aria-label") ?? photo.getAttribute("alt")).toBeTruthy();
    });
    const badges = [...main().querySelectorAll("span")].filter((s) => s.textContent === "Placeholder");
    const expected = TEAM_MEMBERS.filter((m) => m.placeholder).length + (SITE_PHOTOS.about.placeholder ? 1 : 0);
    expect(badges).toHaveLength(expected);
  });

  it("ends with the two booking paths", () => {
    expect(mainLinks().find((a) => clean(a.textContent) === "Book a cleaning")?.getAttribute("href")).toBe("/residential");
    expect(mainLinks().find((a) => clean(a.textContent) === "Or request a commercial quote →")?.getAttribute("href")).toBe("/commercial");
  });
});

describe("Areas & Reviews page (Figma Marketing — Areas)", () => {
  beforeEach(() => render("/areas"));

  it("has the Figma headings in order", () => {
    expect(headings("h1")).toEqual(["Proudly Serving Central New York"]);
    expect(headings("h2")).toEqual(["What Our Clients Say", "Questions or Comments?"]);
  });

  it("tiles every town with its description", () => {
    const tiles = [...main().querySelectorAll('ul[aria-label="Towns we serve"] li')].map((li) => clean(li.textContent));
    expect(tiles).toEqual(SERVICE_AREA_TOWNS.map((t) => `${t.town}${t.note}`));
  });

  it("shows all four reviews", () => {
    const authors = [...main().querySelectorAll('ul[aria-label="Customer reviews"] figcaption')].map((c) => clean(c.textContent).replace("— ", ""));
    expect(authors).toEqual(HOMEPAGE_REVIEWS.map((r) => r.author));
  });

  it("has a contact section other pages can link to, with the phone, email, address and hours", () => {
    const contact = main().querySelector("section#contact")!;
    expect(contact.querySelector(`a[href="${BUSINESS_PHONE.tel}"]`)).not.toBeNull();
    expect(contact.querySelector(`a[href="mailto:${BUSINESS_EMAIL}"]`)).not.toBeNull();
    for (const line of BUSINESS_HOURS) expect(contact.textContent).toContain(line);
    expect(contact.querySelector('a[href="/residential"]')?.textContent).toBe("Book a Residential Cleaning");
    expect(contact.querySelector('a[href="/commercial"]')?.textContent).toBe("Request a Commercial Quote");
  });

  it("labels the map placeholder, visibly and for screen readers", () => {
    const map = main().querySelector('[role="img"][aria-label="Service area map"]')!;
    expect(map).not.toBeNull();
    expect(map.textContent?.includes("Placeholder")).toBe(SERVICE_AREA_MAP.placeholder);
  });
});
