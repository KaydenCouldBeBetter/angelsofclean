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
