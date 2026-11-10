import type { BookingStatus } from "@/lib/supabase/types";

// What the customer portal pages are given. Plain strings and numbers only, with
// the labels already worked out on the server, so the pages stay thin and
// nothing the customer shouldn't see (crew, entry instructions, staff notes,
// other customers' contact details) is ever in the shape.

export interface Visit {
  id: string;
  /** "AOC-1043", the number the customer was given when they booked. */
  ref: string;
  serviceLabel: string;
  frequencyLabel: string;
  /** "YYYY-MM-DD", a New York calendar day. */
  date: string;
  /** "Monday, November 2, 2026" */
  dateLabel: string;
  /** "8:00 AM – 12:00 PM", from the stored window so custom admin windows show too. */
  timeLabel: string;
  address: string;
  /** "Syracuse, 13202" */
  cityLine: string;
  bedrooms: number;
  /** "2.5 Bathrooms" */
  bathroomsLabel: string;
  status: BookingStatus;
  planId: string | null;
}

/** A visit's own page also shows the customer's notes on the booking. */
export interface VisitDetail extends Visit {
  notes: string | null;
}

export interface ServicePlan {
  id: string;
  /** "Standard Clean", or "Commercial cleaning". */
  serviceLabel: string;
  /** "Bi-weekly" */
  frequencyLabel: string;
  address: string;
  cityLine: string;
  status: "active" | "paused";
  statusLabel: string;
}

// What an invoice's chip says. "overdue" isn't stored: it is an open invoice
// whose due day (a New York calendar day) has passed.
export type InvoiceDisplay = "open" | "overdue" | "paid" | "void";

export interface Invoice {
  id: string;
  /** "INV-1000" */
  number: string;
  description: string;
  /** Whole US cents, as stored; never a float. */
  amountCents: number;
  /** "$125.00" */
  amountLabel: string;
  /** "YYYY-MM-DD", a New York calendar day. */
  issuedOn: string;
  /** "November 2, 2026" */
  issuedLabel: string;
  dueOn: string;
  dueLabel: string;
  status: "open" | "paid" | "void";
  /** "December 5, 2026" once paid, otherwise null. */
  paidLabel: string | null;
}

export interface BilledInvoice extends Invoice {
  display: InvoiceDisplay;
}

/** An invoice's own page also shows the payment note and what it was for. */
export interface InvoiceDetail extends Invoice {
  paymentNote: string | null;
  /** The visit it bills for, when it is for one. */
  visit: { id: string; label: string } | null;
  /** "COM-1007", when it is for a commercial quote. */
  quoteRef: string | null;
}

export interface CustomerAccount {
  id: string;
  name: string;
  type: "residential" | "commercial";
  role: "owner" | "member";
}

/** A commercial quote request the account's people have sent in. */
export interface CustomerQuote {
  id: string;
  /** "COM-1007" */
  ref: string;
  /** "November 2, 2026" */
  submittedLabel: string;
  facilityLabel: string;
  /** "2,000–5,000 sq ft" style range, as the form offered it. */
  sqftLabel: string;
  frequencyLabel: string;
  address: string;
  cityLine: string;
}

/** A team member, as the owner sees the team. */
export interface TeamMember {
  userId: string;
  email: string;
  role: "owner" | "member";
  /** "November 2, 2026" */
  joinedLabel: string;
}

/** An invite that hasn't been used. The link itself is never stored, so never here. */
export interface PendingInvite {
  id: string;
  email: string;
  /** "November 9, 2026" */
  expiresLabel: string;
  expired: boolean;
}
