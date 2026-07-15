export type JobStatus = "done" | "active" | "confirmed" | "pending";

export interface Employee {
  id: string;
  name: string;
  initials: string;
  zone: string;
  rating: number;
}

export interface Job {
  id: string;
  client: string;
  service: string;
  address: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  employeeId: string | null;
  status: JobStatus;
}

export const EMPLOYEES: Employee[] = [
  { id: "emp-1", name: "Marcus T.", initials: "MT", zone: "North Syracuse", rating: 4.9 },
  { id: "emp-2", name: "Ana V.",    initials: "AV", zone: "East Side",      rating: 4.8 },
  { id: "emp-3", name: "Rosa C.",   initials: "RC", zone: "Cicero / Clay",  rating: 5.0 },
  { id: "emp-4", name: "Devon M.",  initials: "DM", zone: "Westside",       rating: 4.7 },
  { id: "emp-5", name: "Lisa P.",   initials: "LP", zone: "Camillus / Solvay", rating: 4.6 },
];

// Week of Apr 14–19, 2026
export const JOBS: Job[] = [
  // Monday Apr 14
  {
    id: "job-1",
    client: "Sarah M.",
    service: "Standard Clean",
    address: "14 Maple St, Cicero",
    start: "2026-04-14T09:00:00",
    end:   "2026-04-14T11:00:00",
    employeeId: "emp-1",
    status: "done",
  },
  {
    id: "job-2",
    client: "James R.",
    service: "Deep Clean",
    address: "47 Elm Dr, Cicero",
    start: "2026-04-14T13:00:00",
    end:   "2026-04-14T16:00:00",
    employeeId: "emp-2",
    status: "active",
  },
  {
    id: "job-3",
    client: "First Class Auto",
    service: "Commercial",
    address: "101 Court St, Syracuse",
    start: "2026-04-14T15:00:00",
    end:   "2026-04-14T18:00:00",
    employeeId: "emp-5",
    status: "confirmed",
  },
  {
    id: "job-12",
    client: "Northside Dental",
    service: "Commercial",
    address: "88 Erie Blvd, Syracuse",
    start: "2026-04-14T14:00:00",
    end:   "2026-04-14T17:00:00",
    employeeId: null,
    status: "pending",
  },
  {
    id: "job-13",
    client: "Lisa K.",
    service: "Move-Out",
    address: "22 Pine Ave, Liverpool",
    start: "2026-04-14T17:00:00",
    end:   "2026-04-14T20:00:00",
    employeeId: null,
    status: "pending",
  },
  {
    id: "job-14",
    client: "Tom B.",
    service: "Standard Clean",
    address: "9 Oak Ln, Baldwinsville",
    start: "2026-04-14T10:00:00",
    end:   "2026-04-14T12:00:00",
    employeeId: "emp-3",
    status: "done",
  },
  {
    id: "job-15",
    client: "Karen M.",
    service: "Deep Clean",
    address: "33 Cedar Rd, Solvay",
    start: "2026-04-14T11:00:00",
    end:   "2026-04-14T14:00:00",
    employeeId: "emp-4",
    status: "confirmed",
  },
  // Tuesday Apr 15
  {
    id: "job-4",
    client: "Williams Family",
    service: "Standard Clean",
    address: "8 Birch Ln, Liverpool",
    start: "2026-04-15T10:00:00",
    end:   "2026-04-15T12:00:00",
    employeeId: "emp-1",
    status: "confirmed",
  },
  {
    id: "job-5",
    client: "Karen M.",
    service: "Deep Clean",
    address: "33 Cedar Rd, Solvay",
    start: "2026-04-15T11:00:00",
    end:   "2026-04-15T14:00:00",
    employeeId: "emp-4",
    status: "confirmed",
  },
  // Wednesday Apr 16
  {
    id: "job-6",
    client: "Rodriguez",
    service: "Deep Clean",
    address: "21 Park Ave, Syracuse",
    start: "2026-04-16T10:00:00",
    end:   "2026-04-16T13:00:00",
    employeeId: "emp-5",
    status: "confirmed",
  },
  {
    id: "job-7",
    client: "Northside Dental",
    service: "Commercial",
    address: "88 Erie Blvd, Syracuse",
    start: "2026-04-16T14:00:00",
    end:   "2026-04-16T17:00:00",
    employeeId: null,
    status: "pending",
  },
  // Thursday Apr 17
  {
    id: "job-8",
    client: "Anderson",
    service: "Move-Out",
    address: "55 Oak St, Camillus",
    start: "2026-04-17T09:00:00",
    end:   "2026-04-17T11:00:00",
    employeeId: "emp-3",
    status: "confirmed",
  },
  // Friday Apr 18
  {
    id: "job-9",
    client: "Taylor",
    service: "Standard Clean",
    address: "12 Elm St, Baldwinsville",
    start: "2026-04-18T13:00:00",
    end:   "2026-04-18T15:00:00",
    employeeId: "emp-4",
    status: "confirmed",
  },
  // Saturday Apr 19
  {
    id: "job-10",
    client: "Park Family",
    service: "Standard Clean",
    address: "9 Maple Dr, Cicero",
    start: "2026-04-19T09:00:00",
    end:   "2026-04-19T12:00:00",
    employeeId: "emp-1",
    status: "confirmed",
  },
  {
    id: "job-11",
    client: "Metro Office",
    service: "Commercial",
    address: "200 State St, Syracuse",
    start: "2026-04-19T10:00:00",
    end:   "2026-04-19T13:00:00",
    employeeId: "emp-2",
    status: "confirmed",
  },
];

export const EMPLOYEE_MAP = Object.fromEntries(EMPLOYEES.map((e) => [e.id, e]));

export const STATUS_CONFIG: Record<JobStatus, { label: string; cardBg: string; borderColor: string; chipBg: string; chipText: string }> = {
  done:      { label: "Done",       cardBg: "bg-emerald-50", borderColor: "border-l-emerald-500", chipBg: "bg-emerald-100", chipText: "text-emerald-700" },
  active:    { label: "Active",     cardBg: "bg-orange-50",  borderColor: "border-l-orange-400",  chipBg: "bg-orange-100",  chipText: "text-orange-700"  },
  confirmed: { label: "Confirmed",  cardBg: "bg-blue-50",    borderColor: "border-l-blue-400",    chipBg: "bg-blue-100",    chipText: "text-blue-700"    },
  pending:   { label: "Pending",    cardBg: "bg-zinc-50",    borderColor: "border-l-zinc-400",    chipBg: "bg-zinc-100",    chipText: "text-zinc-500"    },
};

export const DASHBOARD_STATUS: Record<JobStatus, { label: string; chipBg: string; chipText: string }> = {
  done:      { label: "Complete",    chipBg: "bg-[#e1f2e7]", chipText: "text-[#15803d]" },
  active:    { label: "In Progress", chipBg: "bg-[#fef2e8]", chipText: "text-[#d97706]" },
  confirmed: { label: "Confirmed",   chipBg: "bg-[#eaeefc]", chipText: "text-[#1d4ed8]" },
  pending:   { label: "Pending",     chipBg: "bg-[#f7f9f8]", chipText: "text-[#9ca3af]" },
};

export const MOCK_TODAY = "2026-04-14";
