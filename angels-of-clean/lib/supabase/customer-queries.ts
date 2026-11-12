import { cache } from "react";
import { createClient } from "./server";
import type { QueryResult } from "./queries";
import { logAuthError } from "@/lib/auth-input";
import {
  COMMERCIAL_FREQUENCY_LABELS,
  FACILITY_TYPE_LABELS,
  FREQUENCY_LABELS,
  SERVICE_LABELS,
  SQFT_DISPLAY,
  formatBathroomCount,
} from "@/lib/constants";
import { formatBookingDate } from "@/lib/booking-date";
import { formatNyTimeRange, nyDateStr } from "@/lib/datetime";
import { formatCents } from "@/lib/money";
import { PLAN_STATUS_LABEL } from "@/lib/customer-status";
import type {
  CustomerAccount,
  CustomerQuote,
  Invoice,
  InvoiceDetail,
  PendingInvite,
  ServicePlan,
  TeamMember,
  Visit,
  VisitDetail,
} from "@/lib/customer-types";
import type { BookingRow, InvoiceRow, ServicePlanRow } from "./types";

// The customer portal's reads. They run as the signed-in customer, so RLS
// (private.is_account_member on every customer policy) already limits them to
// their own account. Every query below ALSO filters on account_id, because an
// admin who opens /account has a session that RLS lets read every booking: the
// filter is what keeps that page about one account. Explicit column lists keep
// staff-only data (assignments, activity, entry instructions) out of the page,
// and a failed query is { ok: false }, never an empty list, as in queries.ts.

// Log only the Postgres error code plus a correlation id, never row data.
function logQueryError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

const FAILED = { ok: false } as const;

const VISIT_COLUMNS =
  "id,booking_number,service_type,frequency,address,city,zip,bedrooms,bathrooms,scheduled_date,start_at,end_at,status,plan_id" as const;
// The customer's own notes are shown on a visit's own page only.
const VISIT_DETAIL_COLUMNS = `${VISIT_COLUMNS},notes` as const;
const INVOICE_COLUMNS =
  "id,invoice_number,amount_cents,description,issued_on,due_on,status,paid_on" as const;
// The payment note and what the invoice is for are shown on its own page only.
// created_by (which admin made it) is never selected.
export const INVOICE_DETAIL_COLUMNS = `${INVOICE_COLUMNS},payment_note,bookings(id,service_type,scheduled_date),commercial_quotes(quote_number)` as const;
// Plan notes are written for the customer (the admin form says so).
const PLAN_COLUMNS = "id,service_type,frequency,address,city,zip,status,notes" as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VisitRow = Pick<
  BookingRow,
  | "id"
  | "booking_number"
  | "service_type"
  | "frequency"
  | "address"
  | "city"
  | "zip"
  | "bedrooms"
  | "bathrooms"
  | "scheduled_date"
  | "start_at"
  | "end_at"
  | "status"
  | "plan_id"
>;

function toVisit(row: VisitRow): Visit {
  return {
    id: row.id,
    ref: `AOC-${row.booking_number}`,
    serviceLabel: SERVICE_LABELS[row.service_type],
    frequencyLabel: FREQUENCY_LABELS[row.frequency],
    date: row.scheduled_date,
    dateLabel: formatBookingDate(row.scheduled_date, "long"),
    timeLabel: formatNyTimeRange(row.start_at, row.end_at),
    address: row.address,
    cityLine: `${row.city}, ${row.zip}`,
    bedrooms: row.bedrooms,
    bathroomsLabel: formatBathroomCount(row.bathrooms),
    status: row.status,
    planId: row.plan_id,
  };
}

function toPlan(
  row: Pick<ServicePlanRow, "id" | "service_type" | "frequency" | "address" | "city" | "zip" | "status"> &
    Partial<Pick<ServicePlanRow, "notes">>,
): ServicePlan | null {
  // Ended plans aren't shown.
  if (row.status === "ended") return null;
  return {
    id: row.id,
    serviceLabel:
      row.service_type === "commercial" ? "Commercial cleaning" : SERVICE_LABELS[row.service_type],
    frequencyLabel: COMMERCIAL_FREQUENCY_LABELS[row.frequency],
    address: row.address,
    cityLine: `${row.city}, ${row.zip}`,
    status: row.status,
    statusLabel: PLAN_STATUS_LABEL[row.status],
    // Only set when there is something to show.
    ...(row.notes?.trim() ? { notes: row.notes } : {}),
  };
}

/**
 * Links bookings and quote requests made with the customer's confirmed email to
 * their account (see claim_account_records), so ones made since sign-up appear.
 * Idempotent and best effort: a failure just means the portal shows what the
 * account already holds.
 */
export async function claimCustomerRecords(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_account_records");
  if (error) logAuthError("claim_account_records", error);
}

/**
 * The signed-in user's account, or `data: null` if they have none (an admin who
 * never signed up as a customer, or a user whose email isn't confirmed yet).
 * Looked up through the user's own membership row: reading `accounts` directly
 * would return every account to an admin session. Cached for one request, so
 * the layout and the page share one lookup.
 */
export const getCustomerAccount = cache(
  async (): Promise<QueryResult<CustomerAccount | null>> => {
    const supabase = await createClient();

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims.sub;
    if (claimsError || !userId) {
      logQueryError("getCustomerAccount", claimsError ?? undefined);
      return FAILED;
    }

    const { data, error } = await supabase
      .from("account_members")
      .select("role, accounts(id, name, account_type)")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      logQueryError("getCustomerAccount", error);
      return FAILED;
    }
    const account = data?.accounts;
    if (!data || !account) return { ok: true, data: null };

    return {
      ok: true,
      data: { id: account.id, name: account.name, type: account.account_type, role: data.role },
    };
  },
);

/** Every booking on the account, soonest first. Split with splitVisits. */
export async function getCustomerVisits(accountId: string): Promise<QueryResult<Visit[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(VISIT_COLUMNS)
    .eq("account_id", accountId)
    .order("start_at", { ascending: true });

  if (error || !data) {
    logQueryError("getCustomerVisits", error);
    return FAILED;
  }
  return { ok: true, data: data.map(toVisit) };
}

/** One booking on the account, or `data: null` when it isn't theirs or doesn't exist. */
export async function getCustomerVisit(
  accountId: string,
  id: string,
): Promise<QueryResult<VisitDetail | null>> {
  // A malformed id can't match anything; don't send it to Postgres.
  if (!UUID.test(id)) return { ok: true, data: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(VISIT_DETAIL_COLUMNS)
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logQueryError("getCustomerVisit", error);
    return FAILED;
  }
  if (!data) return { ok: true, data: null };
  return { ok: true, data: { ...toVisit(data), notes: data.notes?.trim() ? data.notes : null } };
}

/** The account's active and paused service plans, newest first. */
export async function getServicePlans(accountId: string): Promise<QueryResult<ServicePlan[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_plans")
    .select(PLAN_COLUMNS)
    .eq("account_id", accountId)
    .neq("status", "ended")
    .order("created_at", { ascending: false });

  if (error || !data) {
    logQueryError("getServicePlans", error);
    return FAILED;
  }
  return {
    ok: true,
    data: data.map(toPlan).filter((plan): plan is ServicePlan => plan !== null),
  };
}

type InvoiceListRow = Pick<
  InvoiceRow,
  "id" | "invoice_number" | "amount_cents" | "description" | "issued_on" | "due_on" | "status" | "paid_on"
>;

export function toInvoice(row: InvoiceListRow): Invoice {
  return {
    id: row.id,
    number: `INV-${row.invoice_number}`,
    description: row.description,
    amountCents: row.amount_cents,
    amountLabel: formatCents(row.amount_cents),
    issuedOn: row.issued_on,
    issuedLabel: formatBookingDate(row.issued_on, "medium"),
    dueOn: row.due_on,
    dueLabel: formatBookingDate(row.due_on, "medium"),
    status: row.status,
    paidLabel: row.paid_on ? formatBookingDate(row.paid_on, "medium") : null,
  };
}

/** Every invoice on the account. Split and totalled with prepareInvoices. */
export async function getCustomerInvoices(accountId: string): Promise<QueryResult<Invoice[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("account_id", accountId)
    .order("issued_on", { ascending: false });

  if (error || !data) {
    logQueryError("getCustomerInvoices", error);
    return FAILED;
  }
  return { ok: true, data: data.map(toInvoice) };
}

/** One invoice on the account, or `data: null` when it isn't theirs or doesn't exist. */
export async function getCustomerInvoice(
  accountId: string,
  id: string,
): Promise<QueryResult<InvoiceDetail | null>> {
  if (!UUID.test(id)) return { ok: true, data: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_DETAIL_COLUMNS)
    .eq("account_id", accountId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logQueryError("getCustomerInvoice", error);
    return FAILED;
  }
  if (!data) return { ok: true, data: null };

  return { ok: true, data: toInvoiceDetail(data) };
}

// The row INVOICE_DETAIL_COLUMNS selects: an invoice with its visit and quote.
type InvoiceDetailRow = InvoiceListRow &
  Pick<InvoiceRow, "payment_note"> & {
    bookings: { id: string; service_type: BookingRow["service_type"]; scheduled_date: string } | null;
    commercial_quotes: { quote_number: number } | null;
  };

/** An invoice with what it was for, shared with the admin Customers page. */
export function toInvoiceDetail(row: InvoiceDetailRow): InvoiceDetail {
  const booking = row.bookings;
  return {
    ...toInvoice(row),
    paymentNote: row.payment_note?.trim() ? row.payment_note : null,
    visit: booking
      ? {
          id: booking.id,
          label: `${SERVICE_LABELS[booking.service_type]} on ${formatBookingDate(booking.scheduled_date, "medium")}`,
        }
      : null,
    quoteRef: row.commercial_quotes ? `COM-${row.commercial_quotes.quote_number}` : null,
  };
}


const QUOTE_COLUMNS =
  "id,quote_number,facility_type,sqft_range,frequency,address,city,zip,submitted_at" as const;

/** The account's commercial quote requests, newest first. */
export async function getCustomerQuotes(accountId: string): Promise<QueryResult<CustomerQuote[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commercial_quotes")
    .select(QUOTE_COLUMNS)
    .eq("account_id", accountId)
    .order("submitted_at", { ascending: false });

  if (error || !data) {
    logQueryError("getCustomerQuotes", error);
    return FAILED;
  }
  return {
    ok: true,
    data: data.map((row) => ({
      id: row.id,
      ref: `COM-${row.quote_number}`,
      submittedLabel: formatBookingDate(nyDateStr(row.submitted_at), "medium"),
      facilityLabel: FACILITY_TYPE_LABELS[row.facility_type],
      sqftLabel: SQFT_DISPLAY[row.sqft_range],
      frequencyLabel: COMMERCIAL_FREQUENCY_LABELS[row.frequency],
      address: row.address,
      cityLine: `${row.city}, ${row.zip}`,
    })),
  };
}

/**
 * The owner's view of the team: members and unused invites. RLS only lets an
 * owner read other members' rows (a member sees just their own), so for anyone
 * else this is a partial list; the page only asks for it when the role is owner.
 * Invites are read by explicit columns: token_hash is not granted to customers.
 */
export async function getTeam(
  accountId: string,
): Promise<QueryResult<{ members: TeamMember[]; invites: PendingInvite[] }>> {
  const supabase = await createClient();
  const [membersResult, invitesResult] = await Promise.all([
    supabase
      .from("account_members")
      .select("user_id,email,role,created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true }),
    supabase
      .from("account_invites")
      .select("id,email,expires_at")
      .eq("account_id", accountId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (membersResult.error || !membersResult.data) {
    logQueryError("getTeam.members", membersResult.error);
    return FAILED;
  }
  if (invitesResult.error || !invitesResult.data) {
    logQueryError("getTeam.invites", invitesResult.error);
    return FAILED;
  }

  const nowMs = Date.now();
  return {
    ok: true,
    data: {
      members: membersResult.data.map((m) => ({
        userId: m.user_id,
        email: m.email,
        role: m.role,
        joinedLabel: formatBookingDate(nyDateStr(m.created_at), "medium"),
      })),
      invites: invitesResult.data.map((i) => ({
        id: i.id,
        email: i.email,
        expiresLabel: formatBookingDate(nyDateStr(i.expires_at), "medium"),
        expired: new Date(i.expires_at).getTime() <= nowMs,
      })),
    },
  };
}
