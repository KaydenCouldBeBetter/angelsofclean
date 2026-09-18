import { createClient } from "./server";
import type { Employee, Job, ActivityEntry, JobStatus } from "@/app/admin/data/mock";
import { SERVICE_LABELS, FREQUENCY_LABELS } from "@/lib/constants";
import type { ServiceType, Frequency } from "@/store/bookingStore";

function formatHiredDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Explicit column lists — avoids transferring columns the app never reads.
const BOOKING_COLUMNS =
  "id,booking_number,client_name,email,phone,service_type,frequency,address,city,bedrooms,bathrooms,notes,start_at,end_at,status,submitted_at,booking_employees(employee_id)" as const;

// Calendar projection — the calendar UI renders no contact info, so email,
// phone, and notes must never leave the server for that surface (the API
// route ships this straight to the browser).
const CALENDAR_BOOKING_COLUMNS =
  "id,booking_number,client_name,service_type,frequency,address,city,bedrooms,bathrooms,start_at,end_at,status,submitted_at,booking_employees(employee_id)" as const;

const EMPLOYEE_COLUMNS = "id,name,initials,phone,hired_date" as const;

// Log only the Postgres error code plus a correlation id — full Supabase
// error objects can echo row data (customer PII) into server logs.
function logQueryError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

export async function getEmployees(): Promise<Employee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").select(EMPLOYEE_COLUMNS).order("name");

  if (error || !data) {
    logQueryError("getEmployees", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    initials: row.initials,
    phone: row.phone,
    hiredDate: formatHiredDate(row.hired_date),
  }));
}

// Nested-embed queries (`*, booking_employees(employee_id)`) don't reliably
// narrow through postgrest-js's generic select parser, so the shape is
// asserted here rather than inferred.
type BookingWithEmployees = {
  id: string;
  booking_number: number;
  client_name: string;
  // Absent on the slim calendar projection (CALENDAR_BOOKING_COLUMNS).
  email?: string;
  phone?: string;
  service_type: string;
  frequency: string;
  address: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  notes?: string | null;
  start_at: string;
  end_at: string;
  status: JobStatus;
  submitted_at: string;
  booking_employees: { employee_id: string }[];
};

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count !== 1 ? "s" : ""}`;
}

function mapBookingToJob(row: BookingWithEmployees): Job {
  return {
    id: row.id,
    bookingNumber: row.booking_number,
    client: row.client_name,
    service: SERVICE_LABELS[row.service_type as NonNullable<ServiceType>] ?? row.service_type,
    address: `${row.address}, ${row.city}`,
    start: row.start_at,
    end: row.end_at,
    employeeIds: row.booking_employees.map((be) => be.employee_id),
    status: row.status,
    email: row.email,
    phone: row.phone,
    frequency: FREQUENCY_LABELS[row.frequency as NonNullable<Frequency>] ?? row.frequency,
    property: `${pluralize(row.bedrooms, "Bedroom")} · ${pluralize(row.bathrooms, "Bathroom")}`,
    notes: row.notes ?? undefined,
    submittedAt: row.submitted_at,
  };
}

export async function getJobs(): Promise<Job[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .order("start_at");

  if (error || !data) {
    logQueryError("getJobs", error);
    return [];
  }

  return (data as unknown as BookingWithEmployees[]).map(mapBookingToJob);
}

/**
 * Fetch bookings filtered by date tab — pushes the filter to Supabase
 * so only matching rows are transferred.
 */
export async function getJobsByDateFilter(
  filter: "today" | "upcoming" | "past" | "all",
): Promise<Job[]> {
  const supabase = await createClient();
  const today = localDateStr();

  let query = supabase
    .from("bookings")
    .select(BOOKING_COLUMNS);

  if (filter === "today") {
    query = query.eq("scheduled_date", today);
  } else if (filter === "upcoming") {
    query = query.gt("scheduled_date", today);
  } else if (filter === "past") {
    query = query.lt("scheduled_date", today);
  }
  // "all" — no date filter

  // Past jobs: most recent first. Everything else: chronological.
  const ascending = filter !== "past";
  query = query.order("start_at", { ascending });

  const { data, error } = await query;

  if (error || !data) {
    logQueryError("getJobsByDateFilter", error);
    return [];
  }

  return (data as unknown as BookingWithEmployees[]).map(mapBookingToJob);
}

/**
 * Fetch only today's non-cancelled bookings — used by the employees page.
 */
export async function getTodayJobs(): Promise<Job[]> {
  const supabase = await createClient();
  const today = localDateStr();

  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("scheduled_date", today)
    .neq("status", "cancelled")
    .order("start_at");

  if (error || !data) {
    logQueryError("getTodayJobs", error);
    return [];
  }

  return (data as unknown as BookingWithEmployees[]).map(mapBookingToJob);
}

/**
 * Fetch bookings within a date window — used by the calendar page.
 * Defaults to ±2 months from today so the user can navigate without
 * loading the entire booking history.
 */
export async function getJobsInRange(
  from?: string,
  to?: string,
): Promise<Job[]> {
  const supabase = await createClient();

  if (!from || !to) {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - 2);
    const end = new Date(now);
    end.setMonth(end.getMonth() + 2);
    from = localDateStr(start);
    to = localDateStr(end);
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(CALENDAR_BOOKING_COLUMNS)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .order("start_at");

  if (error || !data) {
    logQueryError("getJobsInRange", error);
    return [];
  }

  return (data as unknown as BookingWithEmployees[]).map(mapBookingToJob);
}

// ---------- Dashboard-specific queries ----------

/** Local YYYY-MM-DD (avoids UTC date shift). */
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface DashboardStats {
  todayJobs: Job[];
  totalPending: number;
  completedThisWeek: number;
  totalEmployees: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const today = localDateStr();

  // Monday of this week
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const weekStart = localDateStr(monday);

  // Sunday end of week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekEnd = localDateStr(sunday);

  const [todayRes, pendingRes, completedRes, employeeRes] = await Promise.all([
    // Today's bookings (non-cancelled)
    supabase
      .from("bookings")
      .select(BOOKING_COLUMNS)
      .eq("scheduled_date", today)
      .neq("status", "cancelled")
      .order("start_at"),

    // ALL pending bookings across all dates
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    // Completed this week
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "done")
      .gte("scheduled_date", weekStart)
      .lte("scheduled_date", weekEnd),

    // Total employees
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true }),
  ]);

  const todayJobs = todayRes.error || !todayRes.data
    ? []
    : (todayRes.data as unknown as BookingWithEmployees[]).map(mapBookingToJob);

  return {
    todayJobs,
    totalPending: pendingRes.count ?? 0,
    completedThisWeek: completedRes.count ?? 0,
    totalEmployees: employeeRes.count ?? 0,
  };
}

export async function getJobById(id: string): Promise<Job | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) logQueryError("getJobById", error);
    return null;
  }

  return mapBookingToJob(data as unknown as BookingWithEmployees);
}

export async function getActivityLog(bookingId: string): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("description,created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    logQueryError("getActivityLog", error);
    return [];
  }

  return data.map((row) => ({
    timestamp: new Date(row.created_at).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    description: row.description,
  }));
}
