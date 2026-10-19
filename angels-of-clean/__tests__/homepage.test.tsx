import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// next/link needs the App Router at runtime; a plain anchor is enough here.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import Home from "@/app/page";
import { BUSINESS_PHONE } from "@/lib/constants";
import {
  HOMEPAGE_REVIEWS,
  HOMEPAGE_TEAM_PHOTOS,
  HOMEPAGE_TRUST_FACTS,
  SERVICE_AREA_TOWNS,
} from "@/lib/homepage-content";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Home />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = () => container.textContent ?? "";
const links = () => [...container.querySelectorAll("a")];

describe("homepage", () => {
  it("has one h1 and never skips a heading level", () => {
    const headings = [...container.querySelectorAll("h1, h2, h3, h4, h5, h6")];
    const levels = headings.map((h) => Number(h.tagName[1]));
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((level, i) => {
      expect(level - levels[i], `heading "${headings[i + 1].textContent}"`).toBeLessThanOrEqual(1);
    });
  });

  it("offers exactly the two booking paths", () => {
    const book = links().find((a) => a.textContent === "Book a cleaning");
    const quote = links().find((a) => a.textContent === "Get a commercial quote");
    expect(book?.getAttribute("href")).toBe("/residential");
    expect(quote?.getAttribute("href")).toBe("/commercial");
  });

  it("has a header, one main landmark and a footer with the privacy and terms links", () => {
    expect(container.querySelectorAll("header")).toHaveLength(1);
    expect(container.querySelectorAll("main")).toHaveLength(1);
    const footer = container.querySelector("footer");
    expect(footer?.querySelector('a[href="/privacy"]')?.textContent).toBe("Privacy Policy");
    expect(footer?.querySelector('a[href="/terms"]')?.textContent).toBe("Terms of Service");
  });

  it("shows the business phone as a tel link and nothing else for the admin", () => {
    expect(container.querySelector(`a[href="${BUSINESS_PHONE.tel}"]`)).not.toBeNull();
    expect(links().some((a) => a.getAttribute("href")?.startsWith("/admin"))).toBe(false);
  });

  it("lists every town in the service area", () => {
    const area = container.querySelector('ul[aria-label="Towns we serve"]');
    const shown = [...(area?.querySelectorAll("li") ?? [])].map((li) => li.textContent);
    expect(shown).toEqual(SERVICE_AREA_TOWNS.map((t) => t.town));
  });

  it("shows no prices", () => {
    expect(text()).not.toMatch(/\$\d/);
  });

  it("labels every placeholder with a visible 'Placeholder' badge", () => {
    const badges = [...container.querySelectorAll("span")].filter((s) => s.textContent === "Placeholder");
    const flagged = (items: { placeholder: boolean }[]) => items.filter((i) => i.placeholder).length;
    // Trust facts appear twice: in the hero strip and in their own section.
    const expected =
      flagged(HOMEPAGE_REVIEWS) + flagged(HOMEPAGE_TRUST_FACTS) * 2 + flagged(HOMEPAGE_TEAM_PHOTOS);
    expect(badges).toHaveLength(expected);
  });

  it("renders each team photo as a labelled image, never an unlabelled one", () => {
    const section = [...container.querySelectorAll("section")].find(
      (s) => s.querySelector("h2")?.textContent === "Meet the team",
    );
    expect(section).toBeDefined();
    const photos = section!.querySelectorAll('[role="img"], img');
    expect(photos).toHaveLength(HOMEPAGE_TEAM_PHOTOS.length);
    photos.forEach((photo) => {
      const label = photo.getAttribute("aria-label") ?? photo.getAttribute("alt");
      expect(label?.trim()).toBeTruthy();
    });
    expect(section!.textContent).toContain("Team photo");
  });

  it("gives every image a text alternative", () => {
    container.querySelectorAll("img").forEach((img) => {
      expect(img.getAttribute("alt")?.trim()).toBeTruthy();
    });
  });

  it("names every section with its heading", () => {
    container.querySelectorAll("section").forEach((section) => {
      const labelledBy = section.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      expect(container.querySelector(`#${labelledBy}`)?.textContent?.trim()).toBeTruthy();
    });
  });
});
