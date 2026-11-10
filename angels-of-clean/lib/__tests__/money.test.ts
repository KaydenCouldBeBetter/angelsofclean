import { describe, expect, it } from "vitest";
import { formatCents } from "../money";

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
