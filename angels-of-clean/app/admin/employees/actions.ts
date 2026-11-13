"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { isUuid } from "@/lib/admin-customers";
import { validateEmployeeInput } from "@/lib/admin-employees";

// Staff roster changes. Every action checks the admin role first (the
// Employees pages sit behind proxy.ts, but server actions are directly
// callable), validates before writing, and goes through the database functions
// in 20261113181527_employee_roster.sql, which check the admin claim again.
// Employees are archived, never deleted.

export type EmployeeActionResult = { success: true } | { success: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";
const fail = (error: string): EmployeeActionResult => ({ success: false, error });

// Log only the Postgres error code plus a correlation id, never the row.
function logDbError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

function revalidateRoster() {
  revalidatePath("/admin/employees");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/bookings");
}

const listFormat = new Intl.ListFormat("en-US", { style: "long", type: "conjunction" });

export async function createEmployee(raw: unknown): Promise<EmployeeActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const parsed = validateEmployeeInput(raw);
  if (!parsed.ok) return fail(parsed.error);
  const employee = parsed.value;

  const { data, error } = await auth.supabase.rpc("create_employee", {
    p_name: employee.name,
    p_initials: employee.initials,
    p_phone: employee.phone,
    p_hired_date: employee.hiredDate,
  });

  // 23505: two admins added the same phone number at once and the unique index caught it.
  if (error?.code === "23505") return fail("An employee with that phone number is already on the roster.");
  if (error || !data) {
    logDbError("createEmployee", error);
    return fail(GENERIC_ERROR);
  }

  switch (data.status) {
    case "created":
      revalidateRoster();
      return { success: true };
    case "duplicate_phone":
      return fail(
        data.archived
          ? `${data.employee_name} has that phone number and is archived. Reactivate them from the Archived tab instead of adding them again.`
          : `${data.employee_name} already has that phone number.`,
      );
  }
}

export async function setEmployeeArchived(
  employeeId: string,
  archived: boolean,
): Promise<EmployeeActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);
  if (!isUuid(employeeId) || typeof archived !== "boolean") return fail("That employee doesn't exist.");

  const { data, error } = await auth.supabase.rpc("set_employee_archived", {
    p_employee_id: employeeId,
    p_archived: archived,
  });

  if (error || !data) {
    logDbError("setEmployeeArchived", error);
    return fail(GENERIC_ERROR);
  }

  switch (data.status) {
    case "archived":
    case "reactivated":
    case "unchanged":
      revalidateRoster();
      revalidatePath(`/admin/employees/${employeeId}`);
      return { success: true };
    case "has_upcoming": {
      const numbers = data.booking_numbers;
      const jobs = listFormat.format(numbers.map((n) => `#${n}`));
      return fail(
        `They're still on ${jobs}. Reassign ${numbers.length === 1 ? "that job" : "those jobs"} or finish ${numbers.length === 1 ? "it" : "them"} first.`,
      );
    }
    case "not_found":
      return fail("That employee doesn't exist.");
  }
}
