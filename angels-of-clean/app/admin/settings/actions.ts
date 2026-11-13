"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import { logAuthError, passwordProblem } from "@/lib/auth-input";
import { validatePreferences } from "@/lib/admin-preferences";

// Settings changes. Every action checks the admin role first (the Settings page
// sits behind proxy.ts, but server actions are directly callable), validates
// before writing, and acts only on the signed-in admin's own account: the
// preferences RPC takes the user from the session, never from an argument.

export type SettingsActionResult = { success: true } | { success: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";
const fail = (error: string): SettingsActionResult => ({ success: false, error });

// Log only the Postgres error code plus a correlation id, never the row.
function logDbError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

/** Saves the admin's display preferences (start page, calendar, bookings list). */
export async function savePreferences(raw: unknown): Promise<SettingsActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const parsed = validatePreferences(raw);
  if (!parsed.ok) return fail(parsed.error);
  const prefs = parsed.value;

  const { data, error } = await auth.supabase.rpc("save_admin_preferences", {
    p_landing_page: prefs.landingPage,
    p_calendar_view: prefs.calendarView,
    p_week_starts_on: prefs.weekStartsOn,
    p_calendar_start_hour: prefs.calendarStartHour,
    p_calendar_end_hour: prefs.calendarEndHour,
    p_unassigned_list_collapsed: prefs.unassignedListCollapsed,
    p_bookings_default_filter: prefs.bookingsDefaultFilter,
  });

  if (error || data?.status !== "saved") {
    logDbError("savePreferences", error);
    return fail(GENERIC_ERROR);
  }

  // Calendar and Bookings read the preferences when they render.
  revalidatePath("/admin/settings");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/bookings");
  return { success: true };
}

/**
 * Sets the name the sidebar shows. It lives in user_metadata, which the signed-in
 * user can edit, so it is for display only and never decides access. Blank
 * clears it (the sidebar then shows the start of the email address).
 */
export async function saveDisplayName(raw: unknown): Promise<SettingsActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  if (typeof raw !== "string") return fail("Invalid name.");
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length > FIELD_MAX_LENGTHS.name) return fail("That name is too long.");

  const { error } = await auth.supabase.auth.updateUser({ data: { full_name: name } });
  if (error) {
    logAuthError("saveDisplayName", error);
    return fail(GENERIC_ERROR);
  }
  return { success: true };
}

/**
 * Changes the signed-in admin's password. The current password is checked first,
 * so someone at an unlocked screen can't lock the admin out. Other sessions stay
 * signed in; "Sign out other devices" ends them.
 */
export async function changePassword(raw: unknown): Promise<SettingsActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  if (typeof raw !== "object" || raw === null) return fail("Invalid password details.");
  const { currentPassword, newPassword } = raw as Record<string, unknown>;
  if (typeof currentPassword !== "string" || currentPassword === "") {
    return fail("Enter your current password.");
  }
  const problem = passwordProblem(newPassword);
  if (problem) return fail(problem);
  if (newPassword === currentPassword) return fail("Choose a password you haven't used for this account.");

  const email = auth.user.email;
  if (!email) return fail(GENERIC_ERROR);

  const check = await auth.supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (check.error) {
    if (check.error.code === "invalid_credentials") return fail("Your current password is incorrect.");
    logAuthError("changePassword", check.error);
    if (check.error.code === "over_request_rate_limit") {
      return fail("Too many attempts. Wait a few minutes and try again.");
    }
    return fail(GENERIC_ERROR);
  }

  const { error } = await auth.supabase.auth.updateUser({ password: newPassword as string });
  if (error) {
    if (error.code === "same_password") return fail("Choose a password you haven't used for this account.");
    // Supabase's own message names the rule the project enforces.
    if (error.code === "weak_password") return fail(error.message);
    logAuthError("changePassword", error);
    return fail(GENERIC_ERROR);
  }
  return { success: true };
}

/** Ends every other session of this admin (other browsers and devices), not this one. */
export async function signOutOtherDevices(): Promise<SettingsActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return fail(auth.error);

  const { error } = await auth.supabase.auth.signOut({ scope: "others" });
  if (error) {
    logAuthError("signOutOtherDevices", error);
    return fail(GENERIC_ERROR);
  }
  return { success: true };
}
