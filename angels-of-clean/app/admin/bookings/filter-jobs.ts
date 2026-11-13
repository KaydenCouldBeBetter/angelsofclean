// Pure filtering for the bookings list: the status dropdown, the employee
// dropdown and the search box. Kept apart from BookingsList so the rules can
// be tested without rendering.
import type { Job, JobStatus, StaffMember } from "@/lib/admin-types";

// "all" shows every status; otherwise one status.
export type StatusFilter = "all" | JobStatus;

// "all" shows every booking; "unassigned" shows bookings with no one on them;
// otherwise an employee id.
export type EmployeeFilter = "all" | "unassigned" | (string & {});

export const UNASSIGNED = "unassigned" as const;

// Order matches the booking flow (pending → confirmed → active → done), with
// cancelled last, so the dropdown reads in the order a booking moves through.
export const STATUS_FILTER_ORDER: readonly JobStatus[] = [
  "pending",
  "confirmed",
  "active",
  "done",
  "cancelled",
];

export function isStatusFilter(value: string): value is StatusFilter {
  return value === "all" || (STATUS_FILTER_ORDER as readonly string[]).includes(value);
}

export interface JobFilters {
  status: StatusFilter;
  employee: EmployeeFilter;
  // Already trimmed and lower-cased.
  search: string;
}

export function hasActiveDropdownFilter({ status, employee }: Pick<JobFilters, "status" | "employee">): boolean {
  return status !== "all" || employee !== "all";
}

function matchesSearch(job: Job, query: string, employeeMap: Record<string, StaffMember>): boolean {
  const employeeNames = job.employeeIds
    .map((id) => employeeMap[id]?.name ?? "")
    .join(" ")
    .toLowerCase();
  return (
    job.client.toLowerCase().includes(query) ||
    job.address.toLowerCase().includes(query) ||
    job.service.toLowerCase().includes(query) ||
    job.status.toLowerCase().includes(query) ||
    String(job.bookingNumber).includes(query) ||
    (job.email?.toLowerCase().includes(query) ?? false) ||
    (job.phone?.includes(query) ?? false) ||
    employeeNames.includes(query)
  );
}

// A booking with two employees matches either of them.
export function filterJobs(
  jobs: Job[],
  { status, employee, search }: JobFilters,
  employeeMap: Record<string, StaffMember>,
): Job[] {
  return jobs.filter((job) => {
    if (status !== "all" && job.status !== status) return false;
    if (employee === UNASSIGNED && job.employeeIds.length > 0) return false;
    if (employee !== "all" && employee !== UNASSIGNED && !job.employeeIds.includes(employee)) return false;
    if (search && !matchesSearch(job, search, employeeMap)) return false;
    return true;
  });
}
