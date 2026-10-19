// Label and color dictionaries for job and employee statuses, shared by the
// admin pages, plus the booking status flow. Contrast is checked in
// __tests__/status-contrast.test.ts.
import type { JobStatus, EmployeeStatus } from "@/lib/admin-types";

// The one allowed booking status flow (backlog B12):
//   pending → confirmed → active → done, and any non-final status → cancelled.
// done and cancelled are final. Postgres enforces the same list
// (booking_status_transition_allowed in
// supabase/migrations/20261019035418_booking_status_flow.sql); this copy only
// decides which buttons the admin sees. __tests__/status-flow.test.ts keeps
// the two equal.
export const STATUS_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  pending:   ["confirmed", "cancelled"],
  confirmed: ["active", "cancelled"],
  active:    ["done", "cancelled"],
  done:      [],
  cancelled: [],
};

export function canChangeStatus(from: JobStatus, to: JobStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

// Nothing moves a booking back to pending.
export type StatusChangeTarget = Exclude<JobStatus, "pending">;

// Activity log text for each status change; set_booking_status appends
// " by {admin email}".
export const STATUS_ACTIVITY_LABEL: Record<StatusChangeTarget, string> = {
  confirmed: "Confirmed",
  active:    "Marked in progress",
  done:      "Marked complete",
  cancelled: "Booking cancelled",
};

export const STATUS_CONFIG: Record<JobStatus, { label: string; cardBg: string; borderColor: string; chipBg: string; chipText: string }> = {
  done:      { label: "Done",       cardBg: "bg-emerald-50", borderColor: "border-l-emerald-500", chipBg: "bg-emerald-100", chipText: "text-emerald-700" },
  active:    { label: "Active",     cardBg: "bg-orange-50",  borderColor: "border-l-orange-400",  chipBg: "bg-orange-100",  chipText: "text-orange-700"  },
  confirmed: { label: "Confirmed",  cardBg: "bg-blue-50",    borderColor: "border-l-blue-400",    chipBg: "bg-blue-100",    chipText: "text-blue-700"    },
  pending:   { label: "Pending",    cardBg: "bg-zinc-50",    borderColor: "border-l-zinc-400",    chipBg: "bg-zinc-100",    chipText: "text-zinc-600"    },
  cancelled: { label: "Cancelled",  cardBg: "bg-red-50",     borderColor: "border-l-red-400",     chipBg: "bg-red-100",     chipText: "text-red-700"     },
};

// Text colors are chosen for WCAG AA (4.5:1) on their own chip background;
// accentColor is also the booking detail banner's text on that background.
export const DASHBOARD_STATUS: Record<JobStatus, { label: string; chipBg: string; chipText: string; accentColor: string }> = {
  done:      { label: "Complete",    chipBg: "bg-[#e1f2e7]", chipText: "text-[#166534]", accentColor: "#166534" },
  active:    { label: "In Progress", chipBg: "bg-[#fef2e8]", chipText: "text-[#b45309]", accentColor: "#b45309" },
  confirmed: { label: "Confirmed",   chipBg: "bg-[#eaeefc]", chipText: "text-[#1d4ed8]", accentColor: "#1d4ed8" },
  pending:   { label: "Pending",     chipBg: "bg-[#f7f9f8]", chipText: "text-[#5c5c5e]", accentColor: "#5c5c5e" },
  cancelled: { label: "Cancelled",   chipBg: "bg-[#feefee]", chipText: "text-[#c0392b]", accentColor: "#c0392b" },
};

export const EMPLOYEE_STATUS_CONFIG: Record<EmployeeStatus, { label: string; dotColor: string; chipBg: string; chipText: string }> = {
  available:  { label: "Available",  dotColor: "bg-green-500",  chipBg: "bg-[#e1f2e7]", chipText: "text-[#166534]" },
  "on-a-job": { label: "On a Job",   dotColor: "bg-orange-400", chipBg: "bg-[#fef2e8]", chipText: "text-[#b45309]" },
  scheduled:  { label: "Scheduled",  dotColor: "bg-blue-500",   chipBg: "bg-[#eaeefc]", chipText: "text-[#1d4ed8]" },
};
