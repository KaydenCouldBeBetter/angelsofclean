"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { FIELD_MAX_LENGTHS, PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { DEFAULT_ADMIN_PREFERENCES, landingPath } from "@/lib/admin-preferences";
import { readAdminPreferences } from "@/lib/supabase/admin-preferences";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Supabase hashes passwords with bcrypt, which ignores everything past 72 bytes.
const PASSWORD_MAX_LENGTH = 72;

// Log only the auth error code plus a correlation id — never the email.
function logAuthError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  // Valid credentials but no admin role claim — don't leave a signed-in
  // session that every admin surface would then refuse.
  // "local" ends only this browser's session: a customer who tried their login
  // here stays signed in to the customer portal on their other devices.
  if (data.user?.app_metadata?.role !== "admin") {
    await supabase.auth.signOut({ scope: "local" });
    return { error: "This account is not authorized for the admin portal." };
  }

  // The admin's own start page from Settings. Never worth failing a sign-in for:
  // if it can't be read, they land on the dashboard like everyone else.
  let landing = landingPath(DEFAULT_ADMIN_PREFERENCES.landingPage);
  try {
    const prefs = await readAdminPreferences(supabase);
    if (prefs.ok) landing = landingPath(prefs.data.landingPage);
  } catch {
    // keep the dashboard
  }
  redirect(landing);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin");
}

/**
 * Emails a password reset link. The result never says whether an account
 * exists for the address, so this can't be used to discover admin emails.
 */
export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  if (
    typeof email !== "string" ||
    email.length > FIELD_MAX_LENGTHS.email ||
    !EMAIL_REGEX.test(email.trim())
  ) {
    return { error: "Enter a valid email address." };
  }

  // Lands on our confirm route even with Supabase's default email template.
  // Supabase only honors it if it's in the project's allowed redirect URLs.
  const origin = (await headers()).get("origin");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim(),
    origin ? { redirectTo: `${origin}/admin/reset-password/confirm` } : undefined,
  );

  if (error) {
    // Logged first: the same code also means the project's email quota ran out.
    logAuthError("requestPasswordReset", error);
    // Supabase sends this only for an address that has an account (it limits
    // emails per user), so a different answer would reveal who is an admin.
    if (error.code === "over_email_send_rate_limit") return {};
    return { error: "Something went wrong. Please try again." };
  }

  return {};
}

/**
 * Sets a new password for the signed-in admin — reached from the reset link,
 * which signs them in for this purpose.
 */
export async function updatePassword(password: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return { error: "Your reset link has expired. Request a new one." };
  }

  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return { error: `Use at least ${PASSWORD_MIN_LENGTH} characters.` };
  }

  if (new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH) {
    return { error: "That password is too long. Use a shorter one." };
  }

  const { error } = await auth.supabase.auth.updateUser({ password });

  if (error) {
    if (error.code === "same_password") {
      return { error: "Choose a password you haven't used for this account." };
    }
    if (error.code === "weak_password") {
      // Supabase's own message names the rule the project enforces.
      return { error: error.message };
    }
    logAuthError("updatePassword", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/admin/dashboard");
}
