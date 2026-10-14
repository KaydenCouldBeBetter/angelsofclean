import { describe, it, expect, vi, beforeEach } from "vitest";

const singleMock = vi.fn();
const selectMock = vi.fn(() => ({ single: singleMock }));
const quotesInsertMock = vi.fn<(row: Record<string, unknown>) => { select: typeof selectMock }>(() => ({
  select: selectMock,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "commercial_quotes") return { insert: quotesInsertMock };
      throw new Error(`Unexpected table in test: ${table}`);
    },
  }),
}));

const allowPublicSubmissionMock = vi.fn<(kind: string) => Promise<boolean>>(() => Promise.resolve(true));
vi.mock("@/lib/rate-limit", () => ({
  allowPublicSubmission: (kind: string) => allowPublicSubmissionMock(kind),
}));

import { submitCommercialQuote, type QuoteData } from "../submitCommercialQuote";
import {
  COMMERCIAL_FACILITY_TYPES,
  COMMERCIAL_FREQUENCIES,
  COMMERCIAL_MAX_FLOORS,
  COMMERCIAL_SERVICE_AREAS,
  COMMERCIAL_SQFT_RANGES,
  FIELD_MAX_LENGTHS,
  SCHEDULE_PREFERENCES,
} from "@/lib/constants";

const VALID_INPUT: QuoteData = {
  facilityType: "office",
  sqftRange: "1k-2k",
  address: "100 Clinton Sq",
  city: "Syracuse",
  zip: "13202",
  floors: 3,
  serviceAreas: ["lobbies", "restrooms"],
  notes: "",
  name: "Dana Lee",
  businessName: "Northside Dental",
  email: "dana@example.com",
  phone: "(315) 555-0100",
  frequency: "weekly",
  schedulePreference: "after",
};

beforeEach(() => {
  vi.clearAllMocks();
  quotesInsertMock.mockImplementation(() => ({ select: selectMock }));
  selectMock.mockImplementation(() => ({ single: singleMock }));
  singleMock.mockResolvedValue({ data: { quote_number: 1007 }, error: null });
  allowPublicSubmissionMock.mockResolvedValue(true);
});

describe("submitCommercialQuote", () => {
  it("stores the quote and returns a reference built from its stored number", async () => {
    const result = await submitCommercialQuote({ ...VALID_INPUT, notes: "  Badge access after 6  " });

    expect(result).toEqual({ success: true, quoteRef: "COM-1007" });
    expect(quotesInsertMock).toHaveBeenCalledTimes(1);
    expect(quotesInsertMock).toHaveBeenCalledWith({
      business_name: "Northside Dental",
      contact_name: "Dana Lee",
      email: "dana@example.com",
      phone: "(315) 555-0100",
      facility_type: "office",
      sqft_range: "1k-2k",
      address: "100 Clinton Sq",
      city: "Syracuse",
      zip: "13202",
      floors: 3,
      service_areas: ["lobbies", "restrooms"],
      frequency: "weekly",
      schedule_preference: "after",
      notes: "Badge access after 6",
    });
  });

  it("stores empty notes and an unset schedule preference as null", async () => {
    await submitCommercialQuote({ ...VALID_INPUT, notes: "   ", schedulePreference: null });

    expect(quotesInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null, schedule_preference: null }),
    );
  });

  it("stores each selected area once", async () => {
    await submitCommercialQuote({
      ...VALID_INPUT,
      serviceAreas: ["lobbies", "lobbies", "restrooms"],
    });

    expect(quotesInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ service_areas: ["lobbies", "restrooms"] }),
    );
  });

  // The old action hardcoded its own lists and rejected every real submission.
  const OFFERED: [string, Partial<QuoteData>][] = [
    ...COMMERCIAL_FACILITY_TYPES.map((t): [string, Partial<QuoteData>] => ["facility type", { facilityType: t.id }]),
    ...COMMERCIAL_SQFT_RANGES.map((r): [string, Partial<QuoteData>] => ["size", { sqftRange: r.id }]),
    ...COMMERCIAL_FREQUENCIES.map((f): [string, Partial<QuoteData>] => ["frequency", { frequency: f.id }]),
    ...SCHEDULE_PREFERENCES.map((p): [string, Partial<QuoteData>] => ["schedule preference", { schedulePreference: p.id }]),
    ...COMMERCIAL_SERVICE_AREAS.map((a): [string, Partial<QuoteData>] => ["service area", { serviceAreas: [a.id] }]),
  ];

  it.each(OFFERED)("accepts every %s the form offers: %o", async (_kind, override) => {
    const result = await submitCommercialQuote({ ...VALID_INPUT, ...override });

    expect(result.success).toBe(true);
  });

  it.each([
    ["an unknown facility type", { facilityType: "warehouse/shop" }, "Invalid facility type."],
    ["an unknown size", { sqftRange: "small" }, "Invalid facility size."],
    ["a blank address", { address: "   " }, "Address and city are required."],
    ["a malformed ZIP", { zip: "1320" }, "Invalid ZIP code."],
    ["a ZIP outside the service area", { zip: "99999" }, "We don't currently serve this area."],
    ["zero floors", { floors: 0 }, `Number of floors must be between 1 and ${COMMERCIAL_MAX_FLOORS}.`],
    [
      "too many floors",
      { floors: COMMERCIAL_MAX_FLOORS + 1 },
      `Number of floors must be between 1 and ${COMMERCIAL_MAX_FLOORS}.`,
    ],
    ["no service areas", { serviceAreas: [] }, "Select at least one area to be serviced."],
    ["an unknown service area", { serviceAreas: ["lobbies", "roof"] }, "Invalid service area."],
    ["a blank contact name", { name: " " }, "Contact name is required."],
    ["a blank business name", { businessName: " " }, "Business name is required."],
    ["an invalid email", { email: "not-an-email" }, "Invalid email address."],
    ["an invalid phone number", { phone: "123" }, "Invalid phone number."],
    ["an unknown frequency", { frequency: "hourly" }, "Invalid frequency."],
    ["an unknown schedule preference", { schedulePreference: "midnight" }, "Invalid schedule preference."],
  ])("rejects %s without touching the database", async (_case, override, error) => {
    const result = await submitCommercialQuote({ ...VALID_INPUT, ...override });

    expect(result).toEqual({ success: false, error });
    expect(quotesInsertMock).not.toHaveBeenCalled();
  });

  it.each([
    ["name", "Contact name"],
    ["businessName", "Business name"],
    ["email", "Email address"],
    ["phone", "Phone number"],
    ["address", "Address"],
    ["city", "City"],
    ["notes", "Special requirements"],
  ] as const)("rejects an over-long %s without touching the database", async (field, label) => {
    const max = FIELD_MAX_LENGTHS[field];
    const result = await submitCommercialQuote({ ...VALID_INPUT, [field]: "x".repeat(max + 1) });

    expect(result).toEqual({
      success: false,
      error: `${label} must be ${max} characters or fewer.`,
    });
    expect(quotesInsertMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-string field", { ...VALID_INPUT, notes: { length: 0 } }],
    ["a missing field", { ...VALID_INPUT, email: undefined }],
    ["a fractional floor count", { ...VALID_INPUT, floors: 1.5 }],
    ["service areas that are not a list", { ...VALID_INPUT, serviceAreas: "lobbies" }],
    ["a non-string service area", { ...VALID_INPUT, serviceAreas: [42] }],
    ["a missing schedule preference", { ...VALID_INPUT, schedulePreference: undefined }],
    ["no payload at all", null],
  ])("rejects %s instead of throwing", async (_case, payload) => {
    // Server Action arguments are not type-checked at runtime.
    const result = await submitCommercialQuote(payload as unknown as QuoteData);

    expect(result).toEqual({ success: false, error: "Invalid quote details." });
    expect(quotesInsertMock).not.toHaveBeenCalled();
  });

  it("never reports success when the quote could not be stored", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Supabase errors can echo the submitted row — the log must not repeat it.
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "42P01", message: "row echo: dana@example.com (315) 555-0100" },
    });

    const result = await submitCommercialQuote(VALID_INPUT);

    expect(result).toEqual({ success: false, error: "Something went wrong. Please try again." });
    expect(result.quoteRef).toBeUndefined();
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("42P01");
    expect(logged).not.toContain("dana@example.com");
    expect(logged).not.toContain("555-0100");
    consoleSpy.mockRestore();
  });

  it("refuses a caller who is over the limit, without touching the database", async () => {
    allowPublicSubmissionMock.mockResolvedValue(false);

    const result = await submitCommercialQuote(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      error:
        "We've received several quote requests from your connection. Please try again in about an hour.",
    });
    expect(quotesInsertMock).not.toHaveBeenCalled();
  });

  it("counts a valid request once, against the quote allowance", async () => {
    await submitCommercialQuote(VALID_INPUT);

    expect(allowPublicSubmissionMock).toHaveBeenCalledTimes(1);
    expect(allowPublicSubmissionMock).toHaveBeenCalledWith("quote");
  });

  it("does not spend the caller's allowance on a request that fails validation", async () => {
    await submitCommercialQuote({ ...VALID_INPUT, email: "not-an-email" });

    expect(allowPublicSubmissionMock).not.toHaveBeenCalled();
  });
});
