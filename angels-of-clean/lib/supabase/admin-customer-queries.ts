import { createClient } from "./server";
import type { QueryResult } from "./queries";
import { INVOICE_DETAIL_COLUMNS, toInvoiceDetail } from "./customer-queries";
import {
  COMMERCIAL_FREQUENCY_LABELS,
  SERVICE_LABELS,
} from "@/lib/constants";
import { formatBookingDate } from "@/lib/booking-date";
import { nyDateStr } from "@/lib/datetime";
import { PLAN_STATUS_LABEL } from "@/lib/customer-status";
import { isUuid } from "@/lib/admin-customers";
import type { AdminAccountDetail, AdminAccountSummary, AdminPlan } from "@/lib/admin-customer-types";

// The admin Customers pages' reads. They run as the signed-in admin, so RLS lets
// them see every account (the admin policies on each table); the pages sit behind
// proxy.ts and the admin role claim. Detail queries still filter on the account
// id explicitly. A failed query is { ok: false }, never an empty list, as in
// queries.ts, and errors log only a code and a correlation id.

function logQueryError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

const FAILED = { ok: false } as const;

const PLAN_ADMIN_COLUMNS = "id,service_type,frequency,address,city,zip,status,notes" as const;

/** Every customer account, newest first, with what staff need at a glance. */
export async function getAdminAccounts(): Promise<QueryResult<AdminAccountSummary[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select(
      "id,name,account_type,created_at,account_members(email,role),service_plans(status),invoices(status,amount_cents),bookings(count)",
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    logQueryError("getAdminAccounts", error);
    return FAILED;
  }

  return {
    ok: true,
    data: data.map((row) => {
      const open = row.invoices.filter((invoice) => invoice.status === "open");
      return {
        id: row.id,
        name: row.name,
        type: row.account_type,
        ownerEmail: row.account_members.find((m) => m.role === "owner")?.email ?? null,
        memberCount: row.account_members.length,
        visitCount: row.bookings[0]?.count ?? 0,
        planCount: row.service_plans.filter((plan) => plan.status !== "ended").length,
        openInvoiceCount: open.length,
        openBalanceCents: open.reduce((sum, invoice) => sum + invoice.amount_cents, 0),
      };
    }),
  };
}

const RECENT_LIMIT = 50;

/** One account with its team, plans, invoices and recent bookings and quotes, or `data: null`. */
export async function getAdminAccountDetail(id: string): Promise<QueryResult<AdminAccountDetail | null>> {
  if (!isUuid(id)) return { ok: true, data: null };

  const supabase = await createClient();
  const [account, plans, invoices, bookings, quotes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,name,account_type,phone,created_at,account_members(email,role)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("service_plans")
      .select(PLAN_ADMIN_COLUMNS)
      .eq("account_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select(INVOICE_DETAIL_COLUMNS)
      .eq("account_id", id)
      .order("issued_on", { ascending: false }),
    supabase
      .from("bookings")
      .select("id,booking_number,service_type,scheduled_date,status")
      .eq("account_id", id)
      .order("start_at", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("commercial_quotes")
      .select("id,quote_number,business_name")
      .eq("account_id", id)
      .order("submitted_at", { ascending: false })
      .limit(RECENT_LIMIT),
  ]);

  const failed = [account, plans, invoices, bookings, quotes].find((result) => result.error);
  if (failed) {
    logQueryError("getAdminAccountDetail", failed.error);
    return FAILED;
  }
  // No error, so a missing account row just means there is no such account.
  if (!account.data) return { ok: true, data: null };
  if (!plans.data || !invoices.data || !bookings.data || !quotes.data) return FAILED;

  const row = account.data;
  return {
    ok: true,
    data: {
      id: row.id,
      name: row.name,
      type: row.account_type,
      phone: row.phone,
      createdLabel: formatBookingDate(nyDateStr(row.created_at), "medium"),
      members: [...row.account_members].sort((a, b) =>
        a.role === b.role ? a.email.localeCompare(b.email) : a.role === "owner" ? -1 : 1,
      ),
      plans: plans.data.map(
        (plan): AdminPlan => ({
          id: plan.id,
          serviceType: plan.service_type,
          serviceLabel:
            plan.service_type === "commercial" ? "Commercial cleaning" : SERVICE_LABELS[plan.service_type],
          frequency: plan.frequency,
          frequencyLabel: COMMERCIAL_FREQUENCY_LABELS[plan.frequency],
          address: plan.address,
          city: plan.city,
          zip: plan.zip,
          status: plan.status,
          statusLabel: PLAN_STATUS_LABEL[plan.status],
          notes: plan.notes,
        }),
      ),
      invoices: invoices.data.map(toInvoiceDetail),
      visits: bookings.data.map((booking) => ({
        id: booking.id,
        ref: `AOC-${booking.booking_number}`,
        label: `${SERVICE_LABELS[booking.service_type]} on ${formatBookingDate(booking.scheduled_date, "medium")}`,
        status: booking.status,
      })),
      quotes: quotes.data.map((quote) => ({
        id: quote.id,
        ref: `COM-${quote.quote_number}`,
        businessName: quote.business_name,
      })),
    },
  };
}
