import { describe, expect, it } from "vitest";
import { HOME_SIZE_OPTIONS, homeSizeLabel, isHomeSize } from "../home-size";

describe("HOME_SIZE_OPTIONS", () => {
  it("offers the owner's three sizes and 'Not sure', smallest first", () => {
    expect(HOME_SIZE_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      ["under-1800", "Under 1,800 sq ft"],
      ["1800-2500", "1,800 to 2,500 sq ft"],
      ["over-2500", "2,500 sq ft or more"],
      ["unsure", "Not sure"],
    ]);
  });

  it("has a unique value and label for every option", () => {
    expect(new Set(HOME_SIZE_OPTIONS.map((o) => o.value)).size).toBe(HOME_SIZE_OPTIONS.length);
    expect(new Set(HOME_SIZE_OPTIONS.map((o) => o.label)).size).toBe(HOME_SIZE_OPTIONS.length);
  });
});

describe("isHomeSize", () => {
  it.each(HOME_SIZE_OPTIONS.map((o) => o.value))("accepts %s", (value) => {
    expect(isHomeSize(value)).toBe(true);
  });

  it.each([
    ["an unknown size", "huge"],
    ["a label instead of a value", "Not sure"],
    ["different case", "UNSURE"],
    ["padded", " unsure"],
    ["an empty string", ""],
    ["null", null],
    ["undefined", undefined],
    ["a number", 1800],
    ["an object", { value: "unsure" }],
  ])("refuses %s", (_name, value) => {
    expect(isHomeSize(value)).toBe(false);
  });
});

describe("homeSizeLabel", () => {
  it("reads each size in words", () => {
    expect(homeSizeLabel("under-1800")).toBe("Under 1,800 sq ft");
    expect(homeSizeLabel("over-2500")).toBe("2,500 sq ft or more");
    expect(homeSizeLabel("unsure")).toBe("Not sure");
  });

  it("says 'Not recorded' for a booking made before it was asked, never a guess", () => {
    expect(homeSizeLabel(null)).toBe("Not recorded");
    expect(homeSizeLabel(undefined)).toBe("Not recorded");
  });
});
