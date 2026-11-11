import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePathMock(...a) }));

const requireAdminMock = vi.fn();
vi.mock("@/lib/supabase/require-admin", () => ({ requireAdmin: () => requireAdminMock() }));

import {
  createInvoice,
  createServicePlan,
  linkBookingToAccount,
  markInvoicePaid,
  reopenInvoice,
  setServicePlanStatus,
  voidInvoice,
} from "../actions";

type DbError = { code: string; message?: string } | null;
interface Call {
  table: string;
  op: "insert" | "update" | "select";
  values?: unknown;
  filters: [string, string, unknown][];
}

const calls: Call[] = [];
// What each table's next statements return, in order.
let responses: Record<string, { data?: unknown; error?: DbError }[]> = {};

function respond(table: string) {
  const queue = responses[table] ?? [];
  return queue.length > 1 ? queue.shift()! : (queue[0] ?? { data: null, error: null });
}

function builder(table: string) {
  const call: Call = { table, op: "select", filters: [] };
  calls.push(call);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const b: any = {};
  const filter = (name: string) => (column: string, value: unknown) => (call.filters.push([name, column, value]), b);
  b.insert = (values: unknown) => ((call.op = "insert"), (call.values = values), b);
  b.update = (values: unknown) => ((call.op = "update"), (call.values = values), b);
  b.select = () => b;
  b.eq = filter("eq");
  b.neq = filter("neq");
  b.is = filter("is");
  const result = () => Promise.resolve(respond(table));
  b.maybeSingle = result;
  b.then = (resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) => result().then(resolve, reject);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return b;
}

const ADMIN = {
  ok: true,
  supabase: { from: (table: string) => builder(table) },
  user: { email: "admin@example.com" },
};

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const PLAN_ID = "22222222-2222-4222-8222-222222222222";
const INVOICE_ID = "33333333-3333-4333-8333-333333333333";
const BOOKING_ID = "44444444-4444-4444-8444-444444444444";

const PLAN = { serviceType: "standard", frequency: "bi-weekly", address: "1 Main St", city: "Syracuse", zip: "13202", notes: "" };
const INVOICE = { amount: "125.50", description: "Standard clean", issuedOn: "2026-11-02", dueOn: "2026-11-30" };

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  responses = {};
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  requireAdminMock.mockResolvedValue(ADMIN);
});

const loggedErrors = () => JSON.stringify(vi.mocked(console.error).mock.calls);

describe("every action needs an admin", () => {
  const SIGNED_OUT = { ok: false, error: "You must be signed in to do this." };
  const NON_ADMIN = { ok: false, error: "You are not authorized to do this." };

  const attempts: [string, () => Promise<unknown>][] = [
    ["createServicePlan", () => createServicePlan(ACCOUNT_ID, PLAN)],
    ["setServicePlanStatus", () => setServicePlanStatus(PLAN_ID, "paused")],
    ["createInvoice", () => createInvoice(ACCOUNT_ID, INVOICE)],
    ["markInvoicePaid", () => markInvoicePaid(INVOICE_ID, {})],
    ["voidInvoice", () => voidInvoice(INVOICE_ID)],
    ["reopenInvoice", () => reopenInvoice(INVOICE_ID)],
    ["linkBookingToAccount", () => linkBookingToAccount(ACCOUNT_ID, "AOC-1043")],
  ];

  it.each(attempts)("%s refuses a signed-out visitor and a signed-in customer, touching nothing", async (_name, attempt) => {
    for (const refusal of [SIGNED_OUT, NON_ADMIN]) {
      requireAdminMock.mockResolvedValue(refusal);
      expect(await attempt()).toEqual({ success: false, error: refusal.error });
    }
    expect(calls).toHaveLength(0);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("createServicePlan", () => {
  it("inserts the validated plan for the account, using only the granted columns", async () => {
    expect(await createServicePlan(ACCOUNT_ID, { ...PLAN, address: " 1 Main St ", notes: "  Gate left " })).toEqual({ success: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      table: "service_plans",
      op: "insert",
      values: {
        account_id: ACCOUNT_ID,
        service_type: "standard",
        frequency: "bi-weekly",
        address: "1 Main St",
        city: "Syracuse",
        zip: "13202",
        notes: "Gate left",
      },
    });
    expect(Object.keys(calls[0].values as object).sort()).toEqual(
      ["account_id", "address", "city", "frequency", "notes", "service_type", "zip"],
    );
  });

  it("revalidates the list and the account's page", async () => {
    await createServicePlan(ACCOUNT_ID, PLAN);
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/customers");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/customers/${ACCOUNT_ID}`);
  });

  it("refuses bad input before writing", async () => {
    expect(await createServicePlan(ACCOUNT_ID, { ...PLAN, zip: "1" })).toEqual({ success: false, error: "Enter a 5-digit ZIP code." });
    expect(await createServicePlan("not-a-uuid", PLAN)).toMatchObject({ success: false });
    expect(await createServicePlan(ACCOUNT_ID, { ...PLAN, frequency: "one-time" })).toMatchObject({ success: false });
    expect(calls).toHaveLength(0);
  });

  it("says when the account is gone, and otherwise logs only a code", async () => {
    responses.service_plans = [{ error: { code: "23503", message: "fk" } }];
    expect(await createServicePlan(ACCOUNT_ID, PLAN)).toEqual({ success: false, error: "That account no longer exists." });

    responses.service_plans = [{ error: { code: "XX000", message: "1 Main St exploded" } }];
    expect(await createServicePlan(ACCOUNT_ID, PLAN)).toEqual({ success: false, error: "Something went wrong. Please try again." });
    expect(loggedErrors()).toContain("XX000");
    expect(loggedErrors()).not.toContain("Main St");
  });
});

describe("setServicePlanStatus", () => {
  it("changes the status of a plan that hasn't ended, and revalidates its account", async () => {
    responses.service_plans = [{ data: [{ account_id: ACCOUNT_ID }] }];
    expect(await setServicePlanStatus(PLAN_ID, "paused")).toEqual({ success: true });
    expect(calls[0]).toMatchObject({ op: "update", values: { status: "paused" } });
    expect(calls[0].filters).toContainEqual(["eq", "id", PLAN_ID]);
    // An ended plan stays ended.
    expect(calls[0].filters).toContainEqual(["neq", "status", "ended"]);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/customers/${ACCOUNT_ID}`);
  });

  it("reports a plan that has ended or is gone", async () => {
    responses.service_plans = [{ data: [] }];
    expect(await setServicePlanStatus(PLAN_ID, "active")).toEqual({
      success: false,
      error: "This plan has ended or no longer exists.",
    });
  });

  it("refuses an unknown status and a malformed id before writing", async () => {
    expect(await setServicePlanStatus(PLAN_ID, "deleted" as never)).toMatchObject({ success: false });
    expect(await setServicePlanStatus("abc", "paused")).toMatchObject({ success: false });
    expect(calls).toHaveLength(0);
  });
});

describe("createInvoice", () => {
  it("inserts whole cents with the account, dates and no subject, using only the granted columns", async () => {
    expect(await createInvoice(ACCOUNT_ID, INVOICE)).toEqual({ success: true });
    expect(calls[0]).toMatchObject({
      table: "invoices",
      op: "insert",
      values: {
        account_id: ACCOUNT_ID,
        booking_id: null,
        quote_id: null,
        amount_cents: 12550,
        description: "Standard clean",
        issued_on: "2026-11-02",
        due_on: "2026-11-30",
      },
    });
    expect(Object.keys(calls[0].values as object).sort()).toEqual(
      ["account_id", "amount_cents", "booking_id", "description", "due_on", "issued_on", "quote_id"],
    );
  });

  it("defaults the issue date to today in New York", async () => {
    await createInvoice(ACCOUNT_ID, { amount: "10", description: "x", dueOn: "2026-12-01" });
    expect((calls[0].values as { issued_on: string }).issued_on).toBe("2026-11-10");
  });

  it("never lets the client set the status, the payment, or who created it", async () => {
    await createInvoice(ACCOUNT_ID, { ...INVOICE, status: "paid", paid_on: "2026-11-01", created_by: "someone", invoice_number: 1 });
    const keys = Object.keys(calls[0].values as object);
    for (const key of ["status", "paid_on", "created_by", "invoice_number", "payment_note"]) expect(keys).not.toContain(key);
  });

  it("attaches a visit or a quote", async () => {
    await createInvoice(ACCOUNT_ID, { ...INVOICE, bookingId: BOOKING_ID });
    expect(calls[0].values).toMatchObject({ booking_id: BOOKING_ID, quote_id: null });
  });

  it.each([
    ["a bad amount", { ...INVOICE, amount: "12.345" }],
    ["a due date before issue", { ...INVOICE, dueOn: "2026-11-01" }],
    ["both a visit and a quote", { ...INVOICE, bookingId: BOOKING_ID, quoteId: BOOKING_ID }],
    ["a blank description", { ...INVOICE, description: " " }],
  ])("refuses %s before writing", async (_case, input) => {
    expect(await createInvoice(ACCOUNT_ID, input)).toMatchObject({ success: false });
    expect(calls).toHaveLength(0);
  });

  it("explains the database refusing another account's visit, and a vanished account", async () => {
    responses.invoices = [{ error: { code: "23514" } }];
    expect(await createInvoice(ACCOUNT_ID, { ...INVOICE, bookingId: BOOKING_ID })).toEqual({
      success: false,
      error: "That visit or quote isn't on this account.",
    });
    responses.invoices = [{ error: { code: "23503" } }];
    expect(await createInvoice(ACCOUNT_ID, INVOICE)).toMatchObject({ success: false });
  });

  it("logs only a code on an unexpected failure", async () => {
    responses.invoices = [{ error: { code: "XX000", message: "Standard clean $125.50 failed" } }];
    await createInvoice(ACCOUNT_ID, INVOICE);
    expect(loggedErrors()).toContain("XX000");
    expect(loggedErrors()).not.toContain("125.50");
  });
});

describe("invoice status changes", () => {
  beforeEach(() => {
    responses.invoices = [{ data: [{ account_id: ACCOUNT_ID }] }];
  });

  it("marks an OPEN invoice paid, with the date and note, and only if it is still open", async () => {
    expect(await markInvoicePaid(INVOICE_ID, { paidOn: "2026-11-05", note: " Check #1042 " })).toEqual({ success: true });
    expect(calls[0]).toMatchObject({
      op: "update",
      values: { status: "paid", paid_on: "2026-11-05", payment_note: "Check #1042" },
    });
    expect(calls[0].filters).toContainEqual(["eq", "id", INVOICE_ID]);
    expect(calls[0].filters).toContainEqual(["eq", "status", "open"]);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/customers/${ACCOUNT_ID}`);
  });

  it("defaults the payment date to today in New York", async () => {
    await markInvoicePaid(INVOICE_ID, {});
    expect((calls[0].values as { paid_on: string }).paid_on).toBe("2026-11-10");
  });

  it("refuses a future or impossible payment date, and an over-long note, before writing", async () => {
    expect(await markInvoicePaid(INVOICE_ID, { paidOn: "2026-11-11" })).toMatchObject({ success: false });
    expect(await markInvoicePaid(INVOICE_ID, { paidOn: "2026-02-30" })).toMatchObject({ success: false });
    expect(await markInvoicePaid(INVOICE_ID, { note: "x".repeat(201) })).toMatchObject({ success: false });
    expect(calls).toHaveLength(0);
  });

  it("cancels only an OPEN invoice", async () => {
    expect(await voidInvoice(INVOICE_ID)).toEqual({ success: true });
    expect(calls[0]).toMatchObject({ op: "update", values: { status: "void", paid_on: null } });
    expect(calls[0].filters).toContainEqual(["eq", "status", "open"]);
  });

  it("reopens only a PAID invoice, clearing the payment", async () => {
    expect(await reopenInvoice(INVOICE_ID)).toEqual({ success: true });
    expect(calls[0]).toMatchObject({ values: { status: "open", paid_on: null, payment_note: null } });
    expect(calls[0].filters).toContainEqual(["eq", "status", "paid"]);
  });

  it.each([
    ["markInvoicePaid", () => markInvoicePaid(INVOICE_ID, {})],
    ["voidInvoice", () => voidInvoice(INVOICE_ID)],
    ["reopenInvoice", () => reopenInvoice(INVOICE_ID)],
  ])("%s says the page is stale when the invoice is no longer in the expected status", async (_name, run) => {
    responses.invoices = [{ data: [] }];
    expect(await run()).toEqual({
      success: false,
      error: "This invoice changed since you loaded the page. Refresh and try again.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("refuses a malformed invoice id before writing", async () => {
    expect(await voidInvoice("abc")).toMatchObject({ success: false });
    expect(await markInvoicePaid("1 or 1=1", {})).toMatchObject({ success: false });
    expect(calls).toHaveLength(0);
  });

  it("logs only a code when the update fails", async () => {
    responses.invoices = [{ error: { code: "23514", message: "Check #1042 broke" } }];
    expect(await voidInvoice(INVOICE_ID)).toEqual({ success: false, error: "Something went wrong. Please try again." });
    expect(loggedErrors()).toContain("23514");
    expect(loggedErrors()).not.toContain("1042");
  });
});

describe("linkBookingToAccount", () => {
  beforeEach(() => {
    responses.accounts = [{ data: { name: "Bob's Bakery" } }];
    responses.bookings = [{ data: { id: BOOKING_ID, account_id: null } }, { data: [{ id: BOOKING_ID }] }];
    responses.activity_log = [{ error: null }];
  });

  it("links an unlinked booking by its number, logs it, and revalidates", async () => {
    expect(await linkBookingToAccount(ACCOUNT_ID, "aoc-1043")).toEqual({ success: true });

    const lookup = calls.find((c) => c.table === "bookings" && c.op === "select")!;
    expect(lookup.filters).toContainEqual(["eq", "booking_number", 1043]);

    const update = calls.find((c) => c.table === "bookings" && c.op === "update")!;
    expect(update.values).toEqual({ account_id: ACCOUNT_ID });
    expect(update.filters).toContainEqual(["eq", "id", BOOKING_ID]);
    // Only an unlinked booking is claimed.
    expect(update.filters).toContainEqual(["is", "account_id", null]);

    const log = calls.find((c) => c.table === "activity_log")!;
    expect(log.values).toEqual({
      booking_id: BOOKING_ID,
      description: 'Linked to customer account "Bob\'s Bakery" by admin@example.com',
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/customers/${ACCOUNT_ID}`);
    expect(revalidatePathMock).toHaveBeenCalledWith(`/admin/bookings/${BOOKING_ID}`);
  });

  it("refuses a booking number it can't read, before any query", async () => {
    expect(await linkBookingToAccount(ACCOUNT_ID, "COM-1007")).toEqual({
      success: false,
      error: "Enter a booking number, like AOC-1043.",
    });
    expect(calls).toHaveLength(0);
  });

  it("says when there is no such booking, or no such account", async () => {
    responses.bookings = [{ data: null }];
    expect(await linkBookingToAccount(ACCOUNT_ID, "1043")).toEqual({ success: false, error: "There is no booking AOC-1043." });
    responses.accounts = [{ data: null }];
    responses.bookings = [{ data: { id: BOOKING_ID, account_id: null } }];
    expect(await linkBookingToAccount(ACCOUNT_ID, "1043")).toEqual({ success: false, error: "That account no longer exists." });
  });

  it("never moves a booking that is on this or another account", async () => {
    responses.bookings = [{ data: { id: BOOKING_ID, account_id: ACCOUNT_ID } }];
    expect(await linkBookingToAccount(ACCOUNT_ID, "1043")).toEqual({ success: false, error: "That booking is already on this account." });

    responses.bookings = [{ data: { id: BOOKING_ID, account_id: "99999999-9999-4999-8999-999999999999" } }];
    const result = await linkBookingToAccount(ACCOUNT_ID, "1043");
    expect(result).toMatchObject({ success: false });
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });

  it("notices when another admin linked it in the meantime", async () => {
    responses.bookings = [{ data: { id: BOOKING_ID, account_id: null } }, { data: [] }];
    expect(await linkBookingToAccount(ACCOUNT_ID, "1043")).toMatchObject({ success: false });
    expect(calls.some((c) => c.table === "activity_log")).toBe(false);
  });

  it("still reports success if only the log entry fails, logging a code", async () => {
    responses.activity_log = [{ error: { code: "42501", message: "Bob's Bakery" } }];
    expect(await linkBookingToAccount(ACCOUNT_ID, "1043")).toEqual({ success: true });
    expect(loggedErrors()).toContain("42501");
    expect(loggedErrors()).not.toContain("Bakery");
  });
});
