const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/**
 * Whole US cents as a dollar amount: 12500 -> "$125.00". Amounts are stored as
 * integer cents (invoices.amount_cents) so nothing is ever added as a float;
 * only this display step divides. Anything that isn't a finite whole number of
 * cents returns "", so a bad value shows as blank, never as a wrong amount.
 */
export function formatCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) return "";
  return USD.format(cents / 100);
}

/** The most one invoice may be for: $1,000,000.00, matching the database's CHECK. */
export const MAX_INVOICE_CENTS = 100_000_000;

/**
 * What an admin typed in a dollar field, as whole cents: "125.50" -> 12550,
 * "$1,250" -> 125000. Done with string arithmetic, never a float, so 19.99 can't
 * become 1998. Returns null for anything that isn't a positive amount with at
 * most two decimals (and correctly placed commas) up to MAX_INVOICE_CENTS.
 */
export function parseDollarsToCents(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const match = input.trim().match(/^\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const dollars = match[1].replaceAll(",", "");
  const cents = (match[2] ?? "").padEnd(2, "0");
  const total = Number(dollars) * 100 + Number(cents);
  if (!Number.isSafeInteger(total) || total <= 0 || total > MAX_INVOICE_CENTS) return null;
  return total;
}
