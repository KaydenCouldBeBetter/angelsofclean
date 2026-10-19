import { describe, it, expect } from "vitest";
import { SERVICE_AREA_ZIPS } from "@/lib/constants";
import {
  HOMEPAGE_REVIEWS,
  HOMEPAGE_TEAM_PHOTOS,
  HOMEPAGE_TRUST_FACTS,
  SERVICE_AREA_TOWNS,
  hasPlaceholders,
  listPlaceholders,
} from "@/lib/homepage-content";

const isBracketed = (text: string) => /^\[.+\]$/.test(text);

describe("homepage placeholders", () => {
  it("lists which placeholders remain (informational; never fails the build)", () => {
    const remaining = listPlaceholders();
    const bySection = new Map<string, string[]>();
    for (const { section, id } of remaining) {
      bySection.set(section, [...(bySection.get(section) ?? []), id]);
    }
    const lines = [...bySection].map(([section, ids]) => `  ${section}: ${ids.join(", ")}`);
    console.info(
      remaining.length === 0
        ? "Homepage: no placeholders remain."
        : `Homepage: ${remaining.length} placeholder(s) still to replace in lib/homepage-content.ts\n${lines.join("\n")}`,
    );

    expect(hasPlaceholders).toBe(remaining.length > 0);
  });

  it("every entry still marked placeholder is obviously fake", () => {
    for (const review of HOMEPAGE_REVIEWS.filter((r) => r.placeholder)) {
      expect(isBracketed(review.quote), review.id).toBe(true);
      expect(isBracketed(review.author), review.id).toBe(true);
      expect(isBracketed(review.location), review.id).toBe(true);
    }
    for (const fact of HOMEPAGE_TRUST_FACTS.filter((f) => f.placeholder)) {
      expect(isBracketed(fact.label), fact.id).toBe(true);
      expect(isBracketed(fact.detail), fact.id).toBe(true);
    }
    for (const photo of HOMEPAGE_TEAM_PHOTOS.filter((p) => p.placeholder)) {
      expect(photo.src, photo.id).toBeNull();
      expect(isBracketed(photo.name), photo.id).toBe(true);
      expect(isBracketed(photo.role), photo.id).toBe(true);
    }
  });

  it("an entry marked as real has no bracketed placeholder text left in it", () => {
    for (const review of HOMEPAGE_REVIEWS.filter((r) => !r.placeholder)) {
      for (const text of [review.quote, review.author, review.location]) {
        expect(text, review.id).not.toMatch(/\[|\]/);
        expect(text.trim(), review.id).not.toBe("");
      }
    }
    for (const fact of HOMEPAGE_TRUST_FACTS.filter((f) => !f.placeholder)) {
      expect(fact.label, fact.id).not.toMatch(/\[|\]/);
      expect(fact.label.trim(), fact.id).not.toBe("");
      expect(fact.detail, fact.id).not.toMatch(/\[|\]/);
    }
    for (const photo of HOMEPAGE_TEAM_PHOTOS.filter((p) => !p.placeholder)) {
      expect(photo.src, photo.id).toMatch(/^\/home\/.+\.(jpe?g|png|webp|avif)$/i);
      expect(photo.alt.trim(), photo.id).not.toBe("");
      expect(photo.name, photo.id).not.toMatch(/\[|\]/);
    }
  });

  it("ids are unique within each list", () => {
    for (const list of [HOMEPAGE_REVIEWS, HOMEPAGE_TRUST_FACTS, HOMEPAGE_TEAM_PHOTOS]) {
      const ids = list.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("SERVICE_AREA_TOWNS", () => {
  it("covers exactly the ZIPs the booking flow accepts", () => {
    const fromTowns = SERVICE_AREA_TOWNS.flatMap((t) => t.zips);
    expect([...fromTowns].sort()).toEqual([...SERVICE_AREA_ZIPS].sort());
  });

  it("lists each town once", () => {
    const towns = SERVICE_AREA_TOWNS.map((t) => t.town);
    expect(new Set(towns).size).toBe(towns.length);
  });
});
