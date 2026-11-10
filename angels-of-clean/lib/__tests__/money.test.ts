import { describe, expect, it } from "vitest";
import { MAX_INVOICE_CENTS, formatCents, parseDollarsToCents } from "../money";

describe("formatCents", () => {
  it.each([
    [12500, "$125.00"],
    [1, "$0.01"],
    [99, "$0.99"],
    [100, "$1.00"],
    [123456, "$1,234.56"],
    [100000000, "$1,000,000.00"],
    [0, "$0.00"],
  ])("%d cents is %s", (cents, label) => {
    expect(formatCents(cents)).toBe(label);
  });

  it("prints a negative amount with a sign rather than hiding it", () => {
    expect(formatCents(-2500)).toBe("-$25.00");
  });

  it.each([1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 2])(
    "shows nothing, never a wrong amount, for %s",
    (value) => {
      expect(formatCents(value)).toBe("");
    },
  );

  it("does not depend on the process time zone or float rounding", () => {
    // 1.005 * 100 style traps: the input is already whole cents.
    expect(formatCents(10050)).toBe("$100.50");
    expect(formatCents(29)).toBe("$0.29");
  });
});

describe("parseDollarsToCents", () => {
  it.each([
    ["125", 12500],
    ["125.5", 12550],
    ["125.50", 12550],
    ["0.01", 1],
    ["19.99", 1999],
    ["$1,250", 125000],
    ["123,456.78", 12345678],
    ["  99.00 ", 9900],
    ["1000000", MAX_INVOICE_CENTS],
    ["1000000.00", MAX_INVOICE_CENTS],
  ])("reads %j as %d cents", (input, cents) => {
    expect(parseDollarsToCents(input)).toBe(cents);
  });

  it("never goes through a float, so classic traps stay exact", () => {
    expect(parseDollarsToCents("0.29")).toBe(29);
    expect(parseDollarsToCents("1.15")).toBe(115);
    expect(parseDollarsToCents("4.35")).toBe(435);
    expect(parseDollarsToCents("8.2")).toBe(820);
  });

  it.each([
    "", "  ", "0", "0.00", "-5", "+5", "12.345", "12.", ".50", "1,2,3", "12,34", "1,2345", "$", "$$5",
    "5 dollars", "1e3", "0x10", "1000000.01", "99999999999999999999", "١٢٣",
  ])("refuses %j", (input) => {
    expect(parseDollarsToCents(input)).toBeNull();
  });

  it.each([125, null, undefined, {}, ["5"]])("refuses the non-string %j", (input) => {
    expect(parseDollarsToCents(input)).toBeNull();
  });

  it("round-trips through the formatter", () => {
    for (const cents of [1, 99, 100, 12550, 123456, MAX_INVOICE_CENTS]) {
      const label = formatCents(cents).replace("$", "");
      expect(parseDollarsToCents(label)).toBe(cents);
    }
  });
});
