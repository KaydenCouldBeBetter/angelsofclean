import type { InvoiceDetail } from "@/lib/customer-types";
import type { BookingStatus } from "@/lib/supabase/types";
import type { PlanFrequency, PlanServiceType, PlanStatus } from "@/lib/admin-customers";

// What the admin Customers pages are given. Staff may see contact emails and
// every status, which the customer shapes in customer-types.ts leave out.

export interface AdminAccountSummary {
  id: string;
  name: string;
  type: "residential" | "commercial";
  ownerEmail: string | null;
  memberCount: number;
  visitCount: number;
  /** Active and paused plans. */
  planCount: number;
  openInvoiceCount: number;
  openBalanceCents: number;
}

export interface AdminPlan {
  id: string;
  serviceType: PlanServiceType;
  serviceLabel: string;
  frequency: PlanFrequency;
  frequencyLabel: string;
  address: string;
  city: string;
  zip: string;
  status: PlanStatus;
  statusLabel: string;
  notes: string | null;
}

export interface AdminVisitRef {
  id: string;
  /** "AOC-1043" */
  ref: string;
  /** "Standard Clean on November 2, 2026" */
  label: string;
  status: BookingStatus;
}

export interface AdminQuoteRef {
  id: string;
  /** "COM-1007" */
  ref: string;
  businessName: string;
}

export interface AdminAccountDetail {
  id: string;
  name: string;
  type: "residential" | "commercial";
  phone: string | null;
  /** "November 2, 2026" */
  createdLabel: string;
  members: { email: string; role: "owner" | "member" }[];
  plans: AdminPlan[];
  invoices: InvoiceDetail[];
  /** The account's recent bookings, newest first. */
  visits: AdminVisitRef[];
  quotes: AdminQuoteRef[];
}
