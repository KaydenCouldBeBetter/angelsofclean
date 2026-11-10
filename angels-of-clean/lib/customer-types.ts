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

export interface CustomerAccount {
  id: string;
  name: string;
  type: "residential" | "commercial";
  role: "owner" | "member";
}
