import { describe, it, expect } from "vitest";
import {
  SERVICE_LABELS,
  FREQUENCY_LABELS,
  TIME_LABELS,
  TIME_SLOT_WINDOWS,
  PRICE_NOTE,
  QUOTE_NOTE,
  SERVICE_DESCRIPTIONS,
  COMMERCIAL_FREQUENCIES,
  COMMERCIAL_FREQUENCY_LABELS,
  FREQUENCY_OPTIONS,
  parseBookingRef,
  parseQuoteRef,
  SERVICE_AREA_ZIPS,
  BATHROOM_LIMITS,
  BATHROOM_OPTIONS,
  formatBathroomCount,
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

// B42: half-bathrooms, matching bookings_bathrooms_check (numeric(2,1)).
describe("BATHROOM_LIMITS", () => {
  it("allows 1 to 5 in half steps", () => {
    expect(BATHROOM_LIMITS).toEqual({ min: 1, max: 5, step: 0.5 });
  });

  it("lists every allowed count as an option", () => {
    expect(BATHROOM_OPTIONS).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
  });
});

describe("formatBathroomCount", () => {
  it.each([
    [1, "1 Bathroom"],
    [1.5, "1.5 Bathrooms"],
    [2, "2 Bathrooms"],
    [2.5, "2.5 Bathrooms"],
    [5, "5 Bathrooms"],
  ])("shows %s as %j", (count, text) => {
    expect(formatBathroomCount(count)).toBe(text);
  });
});

describe("QUOTE_NOTE", () => {
  it("is about a quote request, not a booking, and says nothing is charged online", () => {
    expect(QUOTE_NOTE).toBe(
      "We’ll send your quote after reviewing your request — you won’t be charged anything online.",
    );
    expect(QUOTE_NOTE).not.toMatch(/booking|\$/);
  });
});

describe("SERVICE_DESCRIPTIONS", () => {
  it("has a description for every service", () => {
    expect(Object.keys(SERVICE_DESCRIPTIONS).sort()).toEqual(Object.keys(SERVICE_LABELS).sort());
    for (const text of Object.values(SERVICE_DESCRIPTIONS)) expect(text.length).toBeGreaterThan(20);
  });
});

describe("commercial frequencies (derived from the residential ones)", () => {
  it("reuse every residential label and add the two commercial-only entries in sentence case", () => {
    expect(COMMERCIAL_FREQUENCY_LABELS).toEqual({
      ...FREQUENCY_LABELS,
      "2-3x": "2–3x / week",
      daily: "Daily",
    });
  });

  it("list the residential options first, in the same order, then 2–3x and daily", () => {
    expect(COMMERCIAL_FREQUENCIES.map((f) => f.id)).toEqual([
      ...FREQUENCY_OPTIONS.map((f) => f.id),
      "2-3x",
      "daily",
    ]);
    for (const { id, label } of COMMERCIAL_FREQUENCIES) {
      expect(label).toBe(COMMERCIAL_FREQUENCY_LABELS[id]);
    }
  });
});

describe("confirmation references", () => {
  it("accepts the shapes the server issues", () => {
    expect(parseBookingRef("AOC-1000")).toBe("AOC-1000");
    expect(parseBookingRef("AOC-1043")).toBe("AOC-1043");
    expect(parseQuoteRef("COM-1007")).toBe("COM-1007");
  });

  it.each([
    null, "", "AOC-", "AOC", "aoc-1043", "AOC-1043 ", " AOC-1043", "AOC-1043\n", "AOC-10.5",
    "AOC-１０", "<b>AOC-1043</b>", "COM-1007", "AOC-1043-x",
  ])("turns %j into no booking reference", (value) => {
    expect(parseBookingRef(value)).toBeNull();
  });

  it.each([null, "", "COM-", "com-1007", "COM-1007 ", "COM-1007\n", "AOC-1043", "COM-1; DROP TABLE"])(
    "turns %j into no quote reference",
    (value) => {
      expect(parseQuoteRef(value)).toBeNull();
    },
  );
});
