import { describe, it, expect } from "vitest";
import { SERVICE_AREA_ZIPS } from "@/lib/constants";
import {
  HOMEPAGE_REVIEWS,
  HOMEPAGE_TRUST_BADGES,
  HOME_BASE_TOWN,
  SERVICE_AREA_COORDS,
  SERVICE_AREA_MAP,
  SERVICE_AREA_TOWNS,
  SITE_PHOTOS,
  hasPlaceholders,
  listPlaceholders,
} from "@/lib/homepage-content";

describe("marketing site placeholders", () => {
  it("lists which placeholders remain (informational; never fails the build)", () => {
    const remaining = listPlaceholders();
    const bySection = new Map<string, string[]>();
    for (const { section, id } of remaining) {
      bySection.set(section, [...(bySection.get(section) ?? []), id]);
    }
    const lines = [...bySection].map(([section, ids]) => `  ${section}: ${ids.join(", ")}`);
    console.info(
      remaining.length === 0
        ? "Marketing site: no placeholders remain."
        : `Marketing site: ${remaining.length} placeholder(s) still to replace in lib/homepage-content.ts\n${lines.join("\n")}`,
    );

    expect(hasPlaceholders).toBe(remaining.length > 0);
  });

  it("a photo still marked placeholder has no image yet", () => {
    for (const photo of Object.values(SITE_PHOTOS).filter((p) => p.placeholder)) {
      expect(photo.src, photo.id).toBeNull();
    }
  });

  it("an entry marked as real has no bracketed placeholder text left in it", () => {
    for (const review of HOMEPAGE_REVIEWS.filter((r) => !r.placeholder)) {
      for (const text of [review.quote, review.author]) {
        expect(text, review.id).not.toMatch(/\[|\]/);
        expect(text.trim(), review.id).not.toBe("");
      }
    }
    for (const badge of HOMEPAGE_TRUST_BADGES.filter((b) => !b.placeholder)) {
      expect(badge.label, badge.id).not.toMatch(/\[|\]/);
      expect(badge.shortLabel.trim(), badge.id).not.toBe("");
    }
    for (const photo of Object.values(SITE_PHOTOS).filter((p) => !p.placeholder)) {
      expect(photo.src, photo.id).toMatch(/^\/home\/.+\.(jpe?g|png|webp|avif)$/i);
      expect(photo.alt.trim(), photo.id).not.toBe("");
    }
  });

  it("ids are unique within each list", () => {
    for (const list of [HOMEPAGE_REVIEWS, HOMEPAGE_TRUST_BADGES]) {
      const ids = list.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("a review's highlight is a word-for-word part of its own quote", () => {
    for (const review of HOMEPAGE_REVIEWS.filter((r) => r.highlight !== undefined)) {
      expect(review.highlight!.trim(), review.id).not.toBe("");
      expect(review.quote, review.id).toContain(review.highlight);
    }
  });

  it("at most one review is featured, and it is shown on the homepage", () => {
    const featured = HOMEPAGE_REVIEWS.filter((r) => r.featured);
    expect(featured.length).toBeLessThanOrEqual(1);
    for (const review of featured) expect(review.onHomepage, review.id).toBe(true);
  });

  it("the homepage shows three reviews and the Areas page four", () => {
    expect(HOMEPAGE_REVIEWS.filter((r) => r.onHomepage)).toHaveLength(3);
    expect(HOMEPAGE_REVIEWS).toHaveLength(4);
  });

  it("the service area map is flagged until a real one is built", () => {
    expect(typeof SERVICE_AREA_MAP.placeholder).toBe("boolean");
  });
});

describe("SERVICE_AREA_TOWNS", () => {
  it("covers exactly the ZIPs the booking flow accepts", () => {
    const fromTowns = SERVICE_AREA_TOWNS.flatMap((t) => t.zips);
    expect([...fromTowns].sort()).toEqual([...SERVICE_AREA_ZIPS].sort());
  });

  it("lists each town once, with a description", () => {
    const towns = SERVICE_AREA_TOWNS.map((t) => t.town);
    expect(new Set(towns).size).toBe(towns.length);
    for (const { town, note } of SERVICE_AREA_TOWNS) expect(note.trim(), town).not.toBe("");
  });
});

describe("service area map pins", () => {
  it("has a latitude and longitude near Syracuse for every town, and no extras", () => {
    expect(Object.keys(SERVICE_AREA_COORDS).sort()).toEqual(SERVICE_AREA_TOWNS.map((t) => t.town).sort());
    for (const [lat, lng] of Object.values(SERVICE_AREA_COORDS)) {
      expect(lat).toBeGreaterThan(42.9);
      expect(lat).toBeLessThan(43.3);
      expect(lng).toBeGreaterThan(-76.4);
      expect(lng).toBeLessThan(-75.9);
    }
  });

  it("the home base is one of the towns", () => {
    expect(SERVICE_AREA_TOWNS.map((t) => t.town)).toContain(HOME_BASE_TOWN);
  });
});
