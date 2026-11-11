"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, type AdminContext } from "@/lib/supabase/require-admin";
import { nyTodayStr } from "@/lib/datetime";
import {
  PLAN_STATUSES,
  isUuid,
  parseBookingNumber,
  validateInvoiceInput,
  validatePaymentInput,
  validatePlanInput,
  type PlanStatus,
} from "@/lib/admin-customers";

// Staff-side changes to a customer's account: service plans, invoices, and
// linking a booking. Every action checks the admin role first (the Customers
// pages sit behind proxy.ts, but server actions are directly callable), validates
// before writing, and writes through the admin's own session, so RLS and the
// column grants in 20261110173448_customer_billing_and_plans.sql apply on top.
// Status changes name the status they expect, so a page that has gone stale can't
// overwrite someone else's change.

type ActionResult = { success: true } | { success: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";
const STALE_INVOICE = "This invoice changed since you loaded the page. Refresh and try again.";

const fail = (error: string): ActionResult => ({ success: false, error });

// Log only the Postgres error code plus a correlation id, never the row.
function logDbError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

function revalidateAccount(accountId: string | null) {
  revalidatePath("/admin/customers");
  if (accountId) revalidatePath(`/admin/customers/${accountId}`);
}

export async function createServicePlan(accountId: string, raw: unknown): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(accountId)) return fail("That account doesn't exist.");

  const parsed = validatePlanInput(raw);
  if (!parsed.ok) return fail(parsed.error);
  const plan = parsed.value;

  const { error } = await auth.supabase.from("service_plans").insert({
    account_id: accountId,
    service_type: plan.serviceType,
    frequency: plan.frequency,
    address: plan.address,
    city: plan.city,
    zip: plan.zip,
    notes: plan.notes,
  });

  if (error) {
    if (error.code === "23503") return fail("That account no longer exists.");
    logDbError("createServicePlan", error);
    return fail(GENERIC_ERROR);
  }

  revalidateAccount(accountId);
  return { success: true };
}

// An ended plan stays ended: start a new one instead of reviving it.
export async function setServicePlanStatus(planId: string, status: PlanStatus): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(planId)) return fail("That plan doesn't exist.");
  if (!PLAN_STATUSES.includes(status)) return fail(GENERIC_ERROR);

  const { data, error } = await auth.supabase
    .from("service_plans")
    .update({ status })
    .eq("id", planId)
    .neq("status", "ended")
    .select("account_id");

  if (error) {
    logDbError("setServicePlanStatus", error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail("This plan has ended or no longer exists.");

  revalidateAccount(data[0].account_id);
  return { success: true };
}

export async function createInvoice(accountId: string, raw: unknown): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(accountId)) return fail("That account doesn't exist.");

  const parsed = validateInvoiceInput(raw, nyTodayStr());
  if (!parsed.ok) return fail(parsed.error);
  const invoice = parsed.value;

  const { error } = await auth.supabase.from("invoices").insert({
    account_id: accountId,
    booking_id: invoice.bookingId,
    quote_id: invoice.quoteId,
    amount_cents: invoice.amountCents,
    description: invoice.description,
    issued_on: invoice.issuedOn,
    due_on: invoice.dueOn,
  });

  if (error) {
    if (error.code === "23503") return fail("That account, visit or quote no longer exists.");
    // The database refuses an invoice for a visit or quote on another account.
    if (error.code === "23514") return fail("That visit or quote isn't on this account.");
    logDbError("createInvoice", error);
    return fail(GENERIC_ERROR);
  }

  revalidateAccount(accountId);
  return { success: true };
}

// Moves an invoice from one status to another, only if it is still in `from`.
async function changeInvoiceStatus(
  { supabase }: AdminContext,
  source: string,
  invoiceId: string,
  from: "open" | "paid",
  changes: {
    status: "open" | "paid" | "void";
    paid_on: string | null;
    payment_note?: string | null;
  },
): Promise<ActionResult> {
  if (!isUuid(invoiceId)) return fail("That invoice doesn't exist.");

  const { data, error } = await supabase
    .from("invoices")
    .update(changes)
    .eq("id", invoiceId)
    .eq("status", from)
    .select("account_id");

  if (error) {
    logDbError(source, error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail(STALE_INVOICE);

  revalidateAccount(data[0].account_id);
  return { success: true };
}

export async function markInvoicePaid(invoiceId: string, raw: unknown): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const parsed = validatePaymentInput(raw, nyTodayStr());
  if (!parsed.ok) return fail(parsed.error);

  return changeInvoiceStatus(auth, "markInvoicePaid", invoiceId, "open", {
    status: "paid",
    paid_on: parsed.value.paidOn,
    payment_note: parsed.value.note,
  });
}

/** Cancels an open invoice. A paid one is reopened first (reopenInvoice), then cancelled. */
export async function voidInvoice(invoiceId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  return changeInvoiceStatus(auth, "voidInvoice", invoiceId, "open", { status: "void", paid_on: null });
}

/** Undoes "mark as paid" (a mistake, a bounced check). */
export async function reopenInvoice(invoiceId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  return changeInvoiceStatus(auth, "reopenInvoice", invoiceId, "paid", {
    status: "open",
    paid_on: null,
    payment_note: null,
  });
}

// For a booking whose email doesn't match the account's (a spouse's address, a
// front-desk contact), so the automatic link by email missed it.
export async function linkBookingToAccount(
  accountId: string,
  bookingNumberInput: unknown,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(accountId)) return fail("That account doesn't exist.");

  const bookingNumber = parseBookingNumber(bookingNumberInput);
  if (bookingNumber === null) return fail("Enter a booking number, like AOC-1043.");

  const [account, booking] = await Promise.all([
    auth.supabase.from("accounts").select("name").eq("id", accountId).maybeSingle(),
    auth.supabase
      .from("bookings")
      .select("id,account_id")
      .eq("booking_number", bookingNumber)
      .maybeSingle(),
  ]);

  if (account.error || booking.error) {
    logDbError("linkBookingToAccount", account.error ?? booking.error);
    return fail(GENERIC_ERROR);
  }
  if (!account.data) return fail("That account no longer exists.");
  if (!booking.data) return fail(`There is no booking AOC-${bookingNumber}.`);
  if (booking.data.account_id === accountId) return fail("That booking is already on this account.");
  if (booking.data.account_id) {
    return fail("That booking belongs to a different customer account, so it wasn't moved.");
  }

  // Only an unlinked booking is claimed, so two admins can't overwrite each other.
  const { data, error } = await auth.supabase
    .from("bookings")
    .update({ account_id: accountId })
    .eq("id", booking.data.id)
    .is("account_id", null)
    .select("id");

  if (error) {
    logDbError("linkBookingToAccount", error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail("That booking was just linked to an account. Refresh the page.");

  // The link is done; a failed log entry shouldn't undo it, but it is reported.
  const { error: logError } = await auth.supabase.from("activity_log").insert({
    booking_id: booking.data.id,
    description: `Linked to customer account "${account.data.name}" by ${auth.user.email ?? "an admin"}`,
  });
  if (logError) logDbError("linkBookingToAccount.log", logError);

  revalidateAccount(accountId);
  revalidatePath(`/admin/bookings/${booking.data.id}`);
  return { success: true };
}
