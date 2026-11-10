import { cache } from "react";
import { createClient } from "./server";
import type { QueryResult } from "./queries";
import { logAuthError } from "@/lib/auth-input";
import {
  COMMERCIAL_FREQUENCY_LABELS,
  FREQUENCY_LABELS,
  SERVICE_LABELS,
  formatBathroomCount,
} from "@/lib/constants";
import { formatBookingDate } from "@/lib/booking-date";
import { formatNyTimeRange } from "@/lib/datetime";
import { PLAN_STATUS_LABEL } from "@/lib/customer-status";
import type { CustomerAccount, ServicePlan, Visit, VisitDetail } from "@/lib/customer-types";
import type { BookingRow, ServicePlanRow } from "./types";

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
const PLAN_COLUMNS = "id,service_type,frequency,address,city,zip,status" as const;

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

function toPlan(row: Pick<ServicePlanRow, "id" | "service_type" | "frequency" | "address" | "city" | "zip" | "status">): ServicePlan | null {
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
