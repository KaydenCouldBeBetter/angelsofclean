import { createClient } from "./server";
import type { Employee, Job, ActivityEntry, JobStatus } from "@/app/admin/data/mock";
import { SERVICE_LABELS, FREQUENCY_LABELS } from "@/lib/constants";
import type { ServiceType, Frequency } from "@/store/bookingStore";

function formatHiredDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export async function getEmployees(): Promise<Employee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").select("*").order("name");

  if (error || !data) {
    console.error("getEmployees failed", error);
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
  email: string;
  phone: string;
  service_type: string;
  frequency: string;
  address: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  notes: string | null;
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
    .select("*, booking_employees(employee_id)")
    .order("start_at");

  if (error || !data) {
    console.error("getJobs failed", error);
    return [];
  }

  return (data as unknown as BookingWithEmployees[]).map(mapBookingToJob);
}

export async function getJobById(id: string): Promise<Job | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, booking_employees(employee_id)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("getJobById failed", error);
    return null;
  }

  return mapBookingToJob(data as unknown as BookingWithEmployees);
}

export async function getActivityLog(bookingId: string): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("getActivityLog failed", error);
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
