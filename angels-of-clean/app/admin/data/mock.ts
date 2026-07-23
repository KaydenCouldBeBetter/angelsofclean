export type JobStatus = "done" | "active" | "confirmed" | "pending";

export type EmployeeStatus = "available" | "on-a-job" | "scheduled";

export interface Employee {
  id: string;
  name: string;
  initials: string;
  zone: string;
  rating: number;
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

export const EMPLOYEES: Employee[] = [
  { id: "emp-1", name: "Marcus T.", initials: "MT", zone: "North Syracuse",    rating: 4.9, phone: "(315) 555-0142", hiredDate: "Mar 2024" },
  { id: "emp-2", name: "Ana V.",    initials: "AV", zone: "East Side",         rating: 4.8, phone: "(315) 555-0187", hiredDate: "Jun 2024" },
  { id: "emp-3", name: "Rosa C.",   initials: "RC", zone: "Cicero / Clay",     rating: 5.0, phone: "(315) 555-0231", hiredDate: "Jan 2024" },
  { id: "emp-4", name: "Devon M.",  initials: "DM", zone: "Westside",          rating: 4.7, phone: "(315) 555-0309", hiredDate: "Aug 2024" },
  { id: "emp-5", name: "Lisa P.",   initials: "LP", zone: "Camillus / Solvay", rating: 4.6, phone: "(315) 555-0264", hiredDate: "Nov 2024" },
];

// Week of Apr 14–19, 2026
export const JOBS: Job[] = [
  // Monday Apr 14
  {
    id: "job-1",
    bookingNumber: 1038,
    client: "Sarah M.",
    service: "Standard Clean",
    address: "14 Maple St, Cicero",
    start: "2026-04-14T09:00:00",
    end:   "2026-04-14T11:00:00",
    employeeIds: ["emp-1"],
    status: "done",
    email: "sarah.m@email.com",
    phone: "(315) 555-0101",
    frequency: "Bi-weekly",
    property: "3 Bedrooms · 2 Bathrooms",
    notes: "Leave key under mat.",
    submittedAt: "2026-04-10T10:15:00",
  },
  {
    id: "job-2",
    bookingNumber: 1042,
    client: "James R.",
    service: "Deep Clean",
    address: "47 Elm Dr, Cicero",
    start: "2026-04-14T13:00:00",
    end:   "2026-04-14T16:00:00",
    employeeIds: ["emp-2"],
    status: "active",
    email: "james.r@email.com",
    phone: "(315) 555-0303",
    frequency: "One-time",
    property: "4 Bedrooms · 2.5 Bathrooms",
    notes: "Skip the basement. Two friendly dogs.",
    submittedAt: "2026-04-12T15:41:00",
  },
  {
    id: "job-3",
    bookingNumber: 1044,
    client: "First Class Auto",
    service: "Commercial",
    address: "101 Court St, Syracuse",
    start: "2026-04-14T15:00:00",
    end:   "2026-04-14T18:00:00",
    employeeIds: ["emp-5", "emp-4", "emp-3"],
    status: "confirmed",
    email: "manager@firstclassauto.com",
    phone: "(315) 555-0400",
    frequency: "Weekly",
    property: "Auto dealership · 8,000 sq ft",
    notes: "Enter through service bay. Check in with front desk.",
    submittedAt: "2026-04-11T09:20:00",
  },
  {
    id: "job-12",
    bookingNumber: 1045,
    client: "Northside Dental",
    service: "Commercial",
    address: "88 Erie Blvd, Syracuse",
    start: "2026-04-14T14:00:00",
    end:   "2026-04-14T17:00:00",
    employeeIds: ["emp-2", "emp-1"],
    status: "confirmed",
    email: "office@northsidedental.com",
    phone: "(315) 555-0500",
    frequency: "Weekly",
    property: "Dental office · 3,500 sq ft",
    notes: "Sanitize all patient rooms. Use medical-grade disinfectant.",
    submittedAt: "2026-04-10T14:30:00",
  },
  {
    id: "job-13",
    bookingNumber: 1046,
    client: "Lisa K.",
    service: "Move-Out",
    address: "22 Pine Ave, Liverpool",
    start: "2026-04-14T17:00:00",
    end:   "2026-04-14T20:00:00",
    employeeIds: [],
    status: "pending",
    email: "lisa.k@email.com",
    phone: "(315) 555-0202",
    frequency: "One-time",
    property: "2 Bedrooms · 1 Bathroom",
    notes: "Apartment on 2nd floor, no elevator.",
    submittedAt: "2026-04-13T16:05:00",
  },
  {
    id: "job-14",
    bookingNumber: 1039,
    client: "Tom B.",
    service: "Standard Clean",
    address: "9 Oak Ln, Baldwinsville",
    start: "2026-04-14T10:00:00",
    end:   "2026-04-14T12:00:00",
    employeeIds: ["emp-3"],
    status: "done",
    email: "tom.b@email.com",
    phone: "(315) 555-0115",
    frequency: "Monthly",
    property: "3 Bedrooms · 1.5 Bathrooms",
    submittedAt: "2026-04-08T11:00:00",
  },
  {
    id: "job-15",
    bookingNumber: 1041,
    client: "Karen M.",
    service: "Deep Clean",
    address: "33 Cedar Rd, Solvay",
    start: "2026-04-14T11:00:00",
    end:   "2026-04-14T14:00:00",
    employeeIds: ["emp-4"],
    status: "confirmed",
    email: "karen.m@email.com",
    phone: "(315) 555-0177",
    frequency: "One-time",
    property: "4 Bedrooms · 3 Bathrooms",
    notes: "Allergic to strong scents, use unscented products.",
    submittedAt: "2026-04-11T08:22:00",
  },
  // Tuesday Apr 15
  {
    id: "job-4",
    bookingNumber: 1047,
    client: "Williams Family",
    service: "Standard Clean",
    address: "8 Birch Ln, Liverpool",
    start: "2026-04-15T10:00:00",
    end:   "2026-04-15T12:00:00",
    employeeIds: ["emp-1"],
    status: "confirmed",
    email: "williams.fam@email.com",
    phone: "(315) 555-0330",
    frequency: "Bi-weekly",
    property: "5 Bedrooms · 3 Bathrooms",
    submittedAt: "2026-04-12T09:00:00",
  },
  {
    id: "job-5",
    bookingNumber: 1048,
    client: "Karen M.",
    service: "Deep Clean",
    address: "33 Cedar Rd, Solvay",
    start: "2026-04-15T11:00:00",
    end:   "2026-04-15T14:00:00",
    employeeIds: ["emp-4"],
    status: "confirmed",
    email: "karen.m@email.com",
    phone: "(315) 555-0177",
    frequency: "One-time",
    property: "4 Bedrooms · 3 Bathrooms",
    submittedAt: "2026-04-12T09:15:00",
  },
  // Wednesday Apr 16
  {
    id: "job-6",
    bookingNumber: 1049,
    client: "Rodriguez",
    service: "Deep Clean",
    address: "21 Park Ave, Syracuse",
    start: "2026-04-16T10:00:00",
    end:   "2026-04-16T13:00:00",
    employeeIds: ["emp-5"],
    status: "confirmed",
    email: "rodriguez@email.com",
    phone: "(315) 555-0250",
    frequency: "One-time",
    property: "3 Bedrooms · 2 Bathrooms",
    submittedAt: "2026-04-13T10:00:00",
  },
  {
    id: "job-7",
    bookingNumber: 1050,
    client: "Northside Dental",
    service: "Commercial",
    address: "88 Erie Blvd, Syracuse",
    start: "2026-04-16T14:00:00",
    end:   "2026-04-16T17:00:00",
    employeeIds: [],
    status: "pending",
    email: "office@northsidedental.com",
    phone: "(315) 555-0500",
    frequency: "Weekly",
    property: "Dental office · 3,500 sq ft",
    submittedAt: "2026-04-13T14:30:00",
  },
  // Thursday Apr 17
  {
    id: "job-8",
    bookingNumber: 1051,
    client: "Anderson",
    service: "Move-Out",
    address: "55 Oak St, Camillus",
    start: "2026-04-17T09:00:00",
    end:   "2026-04-17T11:00:00",
    employeeIds: ["emp-3"],
    status: "confirmed",
    email: "anderson@email.com",
    phone: "(315) 555-0275",
    frequency: "One-time",
    property: "2 Bedrooms · 1 Bathroom",
    submittedAt: "2026-04-14T07:00:00",
  },
  // Friday Apr 18
  {
    id: "job-9",
    bookingNumber: 1052,
    client: "Taylor",
    service: "Standard Clean",
    address: "12 Elm St, Baldwinsville",
    start: "2026-04-18T13:00:00",
    end:   "2026-04-18T15:00:00",
    employeeIds: ["emp-4"],
    status: "confirmed",
    email: "taylor@email.com",
    phone: "(315) 555-0290",
    frequency: "Monthly",
    property: "3 Bedrooms · 2 Bathrooms",
    submittedAt: "2026-04-14T12:00:00",
  },
  // Saturday Apr 19
  {
    id: "job-10",
    bookingNumber: 1053,
    client: "Park Family",
    service: "Standard Clean",
    address: "9 Maple Dr, Cicero",
    start: "2026-04-19T09:00:00",
    end:   "2026-04-19T12:00:00",
    employeeIds: ["emp-1"],
    status: "confirmed",
    email: "park.family@email.com",
    phone: "(315) 555-0310",
    frequency: "Weekly",
    property: "4 Bedrooms · 2.5 Bathrooms",
    submittedAt: "2026-04-15T08:30:00",
  },
  {
    id: "job-11",
    bookingNumber: 1054,
    client: "Metro Office",
    service: "Commercial",
    address: "200 State St, Syracuse",
    start: "2026-04-19T10:00:00",
    end:   "2026-04-19T13:00:00",
    employeeIds: ["emp-2"],
    status: "confirmed",
    email: "facilities@metrooffice.com",
    phone: "(315) 555-0600",
    frequency: "Bi-weekly",
    property: "Office suite · 5,000 sq ft",
    submittedAt: "2026-04-15T09:00:00",
  },
];

export const EMPLOYEE_MAP = Object.fromEntries(EMPLOYEES.map((e) => [e.id, e]));

export const JOB_MAP = Object.fromEntries(JOBS.map((j) => [j.id, j]));

export const STATUS_CONFIG: Record<JobStatus, { label: string; cardBg: string; borderColor: string; chipBg: string; chipText: string }> = {
  done:      { label: "Done",       cardBg: "bg-emerald-50", borderColor: "border-l-emerald-500", chipBg: "bg-emerald-100", chipText: "text-emerald-700" },
  active:    { label: "Active",     cardBg: "bg-orange-50",  borderColor: "border-l-orange-400",  chipBg: "bg-orange-100",  chipText: "text-orange-700"  },
  confirmed: { label: "Confirmed",  cardBg: "bg-blue-50",    borderColor: "border-l-blue-400",    chipBg: "bg-blue-100",    chipText: "text-blue-700"    },
  pending:   { label: "Pending",    cardBg: "bg-zinc-50",    borderColor: "border-l-zinc-400",    chipBg: "bg-zinc-100",    chipText: "text-zinc-500"    },
};

export const DASHBOARD_STATUS: Record<JobStatus, { label: string; chipBg: string; chipText: string; accentColor: string }> = {
  done:      { label: "Complete",    chipBg: "bg-[#e1f2e7]", chipText: "text-[#15803d]", accentColor: "#15803d" },
  active:    { label: "In Progress", chipBg: "bg-[#fef2e8]", chipText: "text-[#d97706]", accentColor: "#d97706" },
  confirmed: { label: "Confirmed",   chipBg: "bg-[#eaeefc]", chipText: "text-[#1d4ed8]", accentColor: "#1d4ed8" },
  pending:   { label: "Pending",     chipBg: "bg-[#f7f9f8]", chipText: "text-[#9ca3af]", accentColor: "#9ca3af" },
};

export const MOCK_TODAY = "2026-04-14";

export const EMPLOYEE_STATUS_CONFIG: Record<EmployeeStatus, { label: string; dotColor: string; chipBg: string; chipText: string }> = {
  available:  { label: "Available",  dotColor: "bg-green-500",  chipBg: "bg-[#e1f2e7]", chipText: "text-[#15803d]" },
  "on-a-job": { label: "On a Job",   dotColor: "bg-orange-400", chipBg: "bg-[#fef2e8]", chipText: "text-[#d97706]" },
  scheduled:  { label: "Scheduled",  dotColor: "bg-blue-500",   chipBg: "bg-[#eaeefc]", chipText: "text-[#1d4ed8]" },
};

// Activity logs for booking detail view
export const ACTIVITY_LOGS: Record<string, ActivityEntry[]> = {
  "job-2": [
    { timestamp: "Apr 12, 3:41 PM",  description: "Booking submitted by client" },
    { timestamp: "Apr 13, 9:00 AM",  description: "Confirmed by Jordan L." },
    { timestamp: "Apr 14, 1:03 PM",  description: "Ana V. \u2192 On My Way" },
    { timestamp: "Apr 14, 1:18 PM",  description: "Ana V. \u2192 Arrived" },
  ],
  "job-1": [
    { timestamp: "Apr 10, 10:15 AM", description: "Booking submitted by client" },
    { timestamp: "Apr 10, 2:00 PM",  description: "Confirmed by Jordan L." },
    { timestamp: "Apr 14, 9:00 AM",  description: "Marcus T. \u2192 On My Way" },
    { timestamp: "Apr 14, 9:12 AM",  description: "Marcus T. \u2192 Arrived" },
    { timestamp: "Apr 14, 10:55 AM", description: "Marcus T. \u2192 Completed" },
  ],
  "job-14": [
    { timestamp: "Apr 8, 11:00 AM",  description: "Booking submitted by client" },
    { timestamp: "Apr 9, 8:30 AM",   description: "Confirmed by Jordan L." },
    { timestamp: "Apr 14, 10:00 AM", description: "Rosa C. \u2192 On My Way" },
    { timestamp: "Apr 14, 10:08 AM", description: "Rosa C. \u2192 Arrived" },
    { timestamp: "Apr 14, 11:50 AM", description: "Rosa C. \u2192 Completed" },
  ],
};
