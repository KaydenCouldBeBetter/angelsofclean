import { describe, expect, it } from "vitest";
import {
  INVOICE_DESCRIPTION_MAX,
  PAYMENT_NOTE_MAX,
  PLAN_FREQUENCIES,
  parseBookingNumber,
  validateInvoiceInput,
  validatePaymentInput,
  validatePlanInput,
} from "../admin-customers";
import { FIELD_MAX_LENGTHS } from "../constants";

const TODAY = "2026-11-10";
const UUID = "11111111-1111-4111-8111-111111111111";

const PLAN = {
  serviceType: "standard",
  frequency: "bi-weekly",
  address: " 1 Main St ",
  city: " Syracuse ",
  zip: "13202",
  notes: "  Gate on the left  ",
};
const INVOICE = { amount: "125.50", description: " Standard clean ", dueOn: "2026-11-30" };

describe("validatePlanInput", () => {
  it("accepts a plan and trims its text", () => {
    expect(validatePlanInput(PLAN)).toEqual({
      ok: true,
      value: {
        serviceType: "standard",
        frequency: "bi-weekly",
        address: "1 Main St",
        city: "Syracuse",
        zip: "13202",
        notes: "Gate on the left",
      },
    });
  });

  it("stores blank notes as null", () => {
    const result = validatePlanInput({ ...PLAN, notes: "   " });
    expect(result.ok && result.value.notes).toBeNull();
  });

  it("never offers one-time, and accepts every other frequency", () => {
    expect(PLAN_FREQUENCIES).not.toContain("one-time");
    for (const frequency of PLAN_FREQUENCIES) expect(validatePlanInput({ ...PLAN, frequency }).ok).toBe(true);
    expect(validatePlanInput({ ...PLAN, frequency: "one-time" }).ok).toBe(false);
  });

  it.each([
    ["no input", null],
    ["a non-object", "plan"],
    ["an unknown service", { ...PLAN, serviceType: "carpet" }],
    ["a blank address", { ...PLAN, address: "  " }],
    ["an over-long address", { ...PLAN, address: "x".repeat(FIELD_MAX_LENGTHS.address + 1) }],
    ["a blank city", { ...PLAN, city: "" }],
    ["an over-long city", { ...PLAN, city: "x".repeat(FIELD_MAX_LENGTHS.city + 1) }],
    ["a 4-digit ZIP", { ...PLAN, zip: "1320" }],
    ["a ZIP with letters", { ...PLAN, zip: "1320a" }],
    ["a non-string address", { ...PLAN, address: 5 }],
    ["over-long notes", { ...PLAN, notes: "x".repeat(FIELD_MAX_LENGTHS.notes + 1) }],
  ])("refuses %s", (_case, input) => {
    expect(validatePlanInput(input).ok).toBe(false);
  });
});

describe("validateInvoiceInput", () => {
  it("accepts an invoice, converting dollars to whole cents and defaulting the issue date", () => {
    expect(validateInvoiceInput(INVOICE, TODAY)).toEqual({
      ok: true,
      value: {
        amountCents: 12550,
        description: "Standard clean",
        issuedOn: TODAY,
        dueOn: "2026-11-30",
        bookingId: null,
        quoteId: null,
      },
    });
  });

  it("takes an explicit issue date and a visit or a quote", () => {
    const withVisit = validateInvoiceInput({ ...INVOICE, issuedOn: "2026-11-02", bookingId: UUID }, TODAY);
    expect(withVisit.ok && withVisit.value).toMatchObject({ issuedOn: "2026-11-02", bookingId: UUID });
    const withQuote = validateInvoiceInput({ ...INVOICE, quoteId: UUID }, TODAY);
    expect(withQuote.ok && withQuote.value.quoteId).toBe(UUID);
  });

  it("allows due on the issue day, but not before it", () => {
    expect(validateInvoiceInput({ ...INVOICE, dueOn: TODAY }, TODAY).ok).toBe(true);
    const before = validateInvoiceInput({ ...INVOICE, dueOn: "2026-11-09" }, TODAY);
    expect(before).toEqual({ ok: false, error: "The due date can't be before the issue date." });
  });

  it.each([
    ["a blank amount", { ...INVOICE, amount: "" }],
    ["a zero amount", { ...INVOICE, amount: "0" }],
    ["a negative amount", { ...INVOICE, amount: "-5" }],
    ["an amount in words", { ...INVOICE, amount: "fifty" }],
    ["a numeric amount (must be typed text)", { ...INVOICE, amount: 125 }],
    ["an amount over a million dollars", { ...INVOICE, amount: "1000000.01" }],
    ["a blank description", { ...INVOICE, description: "  " }],
    ["an over-long description", { ...INVOICE, description: "x".repeat(INVOICE_DESCRIPTION_MAX + 1) }],
    ["an impossible issue date", { ...INVOICE, issuedOn: "2026-02-30" }],
    ["a missing due date", { ...INVOICE, dueOn: "" }],
    ["an impossible due date", { ...INVOICE, dueOn: "2026-13-01" }],
    ["a malformed visit id", { ...INVOICE, bookingId: "not-a-uuid" }],
    ["a malformed quote id", { ...INVOICE, quoteId: "1; drop table invoices" }],
    ["both a visit and a quote", { ...INVOICE, bookingId: UUID, quoteId: UUID }],
    ["no input", undefined],
  ])("refuses %s", (_case, input) => {
    expect(validateInvoiceInput(input, TODAY).ok).toBe(false);
  });

  it("accepts the largest amount the database allows", () => {
    const result = validateInvoiceInput({ ...INVOICE, amount: "1,000,000.00" }, TODAY);
    expect(result.ok && result.value.amountCents).toBe(100_000_000);
  });
});

describe("validatePaymentInput", () => {
  it("defaults to paid today with no note", () => {
    expect(validatePaymentInput({}, TODAY)).toEqual({ ok: true, value: { paidOn: TODAY, note: null } });
  });

  it("takes a past date and a trimmed note", () => {
    expect(validatePaymentInput({ paidOn: "2026-11-05", note: " Check #1042 " }, TODAY)).toEqual({
      ok: true,
      value: { paidOn: "2026-11-05", note: "Check #1042" },
    });
  });

  it.each([
    ["a future date", { paidOn: "2026-11-11" }],
    ["an impossible date", { paidOn: "2026-02-31" }],
    ["an over-long note", { note: "x".repeat(PAYMENT_NOTE_MAX + 1) }],
    ["no input", null],
  ])("refuses %s", (_case, input) => {
    expect(validatePaymentInput(input, TODAY).ok).toBe(false);
  });

  it("treats a payment today as fine", () => {
    expect(validatePaymentInput({ paidOn: TODAY }, TODAY).ok).toBe(true);
  });
});

describe("parseBookingNumber", () => {
  it.each([
    ["AOC-1043", 1043],
    ["aoc-1043", 1043],
    ["  1043 ", 1043],
    ["1043", 1043],
  ])("reads %j as %d", (input, n) => {
    expect(parseBookingNumber(input)).toBe(n);
  });

  it.each(["", "AOC-", "COM-1007", "10.5", "-3", "0", "abc", "1043; drop", "12345678901234", 1043, null])(
    "refuses %j",
    (input) => {
      expect(parseBookingNumber(input)).toBeNull();
    },
  );
});
