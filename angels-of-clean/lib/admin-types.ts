// Shapes the admin pages work with, built from database rows by
// lib/supabase/queries.ts. Row types themselves live in lib/supabase/types.ts.
import type { BookingStatus } from "./supabase/types";

export type JobStatus = BookingStatus;

export type EmployeeStatus = "available" | "on-a-job" | "scheduled";

export interface Employee {
  id: string;
  name: string;
  initials: string;
  phone: string;
  hiredDate: string; // e.g. "Mar 2024"
}

export interface Job {
  id: string;
  bookingNumber: number;
  client: string;
  service: string;
  address: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  employeeIds: string[];
  status: JobStatus;
  // Detail fields
  email?: string;
  phone?: string;
  frequency?: string;
  property?: string;
  notes?: string;
  submittedAt?: string;
}

export interface ActivityEntry {
  timestamp: string;
  description: string;
}
