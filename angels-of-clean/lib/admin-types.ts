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

// What client components need to show and assign staff. Server pages pass
// this, never a full Employee, so staff phone numbers stay on the server
// (only the employees page, a server component, shows them).
export type StaffMember = Pick<Employee, "id" | "name" | "initials">;

export function toStaffMember({ id, name, initials }: Employee): StaffMember {
  return { id, name, initials };
}

export function toStaffMap(employees: Employee[]): Record<string, StaffMember> {
  return Object.fromEntries(employees.map((e) => [e.id, toStaffMember(e)]));
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
