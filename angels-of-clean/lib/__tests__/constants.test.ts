import { describe, it, expect } from "vitest";
import {
  SERVICE_LABELS,
  FREQUENCY_LABELS,
  TIME_LABELS,
  TIME_SLOT_WINDOWS,
  PRICE_NOTE,
  SERVICE_AREA_ZIPS,
} from "@/lib/constants";

describe("SERVICE_LABELS", () => {
  it("has entries for all service types", () => {
    expect(SERVICE_LABELS.standard).toBe("Standard Clean");
    expect(SERVICE_LABELS.deep).toBe("Deep Clean");
    expect(SERVICE_LABELS.moveinout).toBe("Move-In / Move-Out");
    expect(Object.keys(SERVICE_LABELS)).toHaveLength(3);
  });
});

describe("FREQUENCY_LABELS", () => {
  it("has entries for all frequencies", () => {
    expect(FREQUENCY_LABELS["one-time"]).toBe("One-time");
    expect(FREQUENCY_LABELS.weekly).toBe("Weekly");
    expect(FREQUENCY_LABELS["bi-weekly"]).toBe("Bi-weekly");
    expect(FREQUENCY_LABELS.monthly).toBe("Monthly");
    expect(Object.keys(FREQUENCY_LABELS)).toHaveLength(4);
  });
});

describe("TIME_LABELS", () => {
  it("has entries for morning and afternoon", () => {
    expect(TIME_LABELS.morning).toContain("Morning");
    expect(TIME_LABELS.afternoon).toContain("Afternoon");
    expect(Object.keys(TIME_LABELS)).toHaveLength(2);
  });
});

describe("TIME_SLOT_WINDOWS", () => {
  it("stores the windows customers are shown: morning 8–12, afternoon 12–4", () => {
    expect(TIME_SLOT_WINDOWS.morning.start).toBe("08:00:00");
    expect(TIME_SLOT_WINDOWS.morning.end).toBe("12:00:00");
    expect(TIME_SLOT_WINDOWS.afternoon.start).toBe("12:00:00");
    expect(TIME_SLOT_WINDOWS.afternoon.end).toBe("16:00:00");
  });

  it("display range matches the stored start/end times for every slot", () => {
    const to12h = (time: string) => {
      const hour = Number(time.split(":")[0]);
      const meridiem = hour < 12 ? "AM" : "PM";
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      return `${hour12}:00 ${meridiem}`;
    };
    for (const window of Object.values(TIME_SLOT_WINDOWS)) {
      expect(window.display).toBe(`${to12h(window.start)} – ${to12h(window.end)}`);
    }
  });

  it("TIME_LABELS is derived from the same windows", () => {
    expect(TIME_LABELS.morning).toBe(`Morning (${TIME_SLOT_WINDOWS.morning.display})`);
    expect(TIME_LABELS.afternoon).toBe(`Afternoon (${TIME_SLOT_WINDOWS.afternoon.display})`);
  });
});

describe("PRICE_NOTE", () => {
  it("says the price is confirmed later and nothing is charged online", () => {
    expect(PRICE_NOTE).toContain("confirm your price");
    expect(PRICE_NOTE).toContain("charged anything online");
    expect(PRICE_NOTE).not.toMatch(/\$/);
  });
});

describe("SERVICE_AREA_ZIPS", () => {
  it("includes known Syracuse area ZIP codes", () => {
    expect(SERVICE_AREA_ZIPS).toContain("13202"); // Syracuse
    expect(SERVICE_AREA_ZIPS).toContain("13039"); // Cicero
    expect(SERVICE_AREA_ZIPS).toContain("13088"); // Liverpool
    expect(SERVICE_AREA_ZIPS).toContain("13027"); // Baldwinsville
  });

  it("excludes non-service-area ZIP codes", () => {
    expect(SERVICE_AREA_ZIPS).not.toContain("10001"); // NYC
    expect(SERVICE_AREA_ZIPS).not.toContain("90210"); // Beverly Hills
    expect(SERVICE_AREA_ZIPS).not.toContain("00000");
    expect(SERVICE_AREA_ZIPS).not.toContain("13035"); // Cazenovia, once mislabeled Camillus
  });

  // Each town is pinned to its ZIPs so a swap on the wrong line fails here.
  const ZIPS_BY_TOWN: [string, string[]][] = [
    ["Cicero", ["13039"]],
    ["Camillus", ["13031"]],
    ["Syracuse", [
      "13201", "13202", "13203", "13204", "13205", "13206", "13207",
      "13208", "13210", "13214", "13215", "13219", "13224",
    ]],
    ["Liverpool", ["13088", "13090"]],
    ["Baldwinsville", ["13027"]],
    ["Brewerton", ["13029"]],
    ["Solvay", ["13209"]],
    ["Manlius", ["13104"]],
    ["Marcellus", ["13108"]],
  ];

  it.each(ZIPS_BY_TOWN)("serves %s", (_town, zips) => {
    for (const zip of zips) expect(SERVICE_AREA_ZIPS).toContain(zip);
  });

  it("lists no ZIP outside the known towns, and none twice", () => {
    const expected = ZIPS_BY_TOWN.flatMap(([, zips]) => zips);
    expect([...SERVICE_AREA_ZIPS].sort()).toEqual([...expected].sort());
  });
});
