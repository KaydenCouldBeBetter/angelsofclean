// UI-config-only: types and label/color dictionaries shared by the admin pages.
// Data (jobs, employees, activity logs) now comes from lib/supabase/queries.ts.

export type JobStatus = "done" | "active" | "confirmed" | "pending" | "cancelled";

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

export const STATUS_CONFIG: Record<JobStatus, { label: string; cardBg: string; borderColor: string; chipBg: string; chipText: string }> = {
  done:      { label: "Done",       cardBg: "bg-emerald-50", borderColor: "border-l-emerald-500", chipBg: "bg-emerald-100", chipText: "text-emerald-700" },
  active:    { label: "Active",     cardBg: "bg-orange-50",  borderColor: "border-l-orange-400",  chipBg: "bg-orange-100",  chipText: "text-orange-700"  },
  confirmed: { label: "Confirmed",  cardBg: "bg-blue-50",    borderColor: "border-l-blue-400",    chipBg: "bg-blue-100",    chipText: "text-blue-700"    },
  pending:   { label: "Pending",    cardBg: "bg-zinc-50",    borderColor: "border-l-zinc-400",    chipBg: "bg-zinc-100",    chipText: "text-zinc-500"    },
  cancelled: { label: "Cancelled",  cardBg: "bg-red-50",     borderColor: "border-l-red-400",     chipBg: "bg-red-100",     chipText: "text-red-700"     },
};

export const DASHBOARD_STATUS: Record<JobStatus, { label: string; chipBg: string; chipText: string; accentColor: string }> = {
  done:      { label: "Complete",    chipBg: "bg-[#e1f2e7]", chipText: "text-[#15803d]", accentColor: "#15803d" },
  active:    { label: "In Progress", chipBg: "bg-[#fef2e8]", chipText: "text-[#d97706]", accentColor: "#d97706" },
  confirmed: { label: "Confirmed",   chipBg: "bg-[#eaeefc]", chipText: "text-[#1d4ed8]", accentColor: "#1d4ed8" },
  pending:   { label: "Pending",     chipBg: "bg-[#f7f9f8]", chipText: "text-[#9ca3af]", accentColor: "#9ca3af" },
  cancelled: { label: "Cancelled",   chipBg: "bg-[#feefee]", chipText: "text-[#c0392b]", accentColor: "#c0392b" },
};

export const EMPLOYEE_STATUS_CONFIG: Record<EmployeeStatus, { label: string; dotColor: string; chipBg: string; chipText: string }> = {
  available:  { label: "Available",  dotColor: "bg-green-500",  chipBg: "bg-[#e1f2e7]", chipText: "text-[#15803d]" },
  "on-a-job": { label: "On a Job",   dotColor: "bg-orange-400", chipBg: "bg-[#fef2e8]", chipText: "text-[#d97706]" },
  scheduled:  { label: "Scheduled",  dotColor: "bg-blue-500",   chipBg: "bg-[#eaeefc]", chipText: "text-[#1d4ed8]" },
};
