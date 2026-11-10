"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/supabase/require-customer";
import { completeCustomerSignIn } from "@/lib/supabase/customer-session";
import { allowPublicSubmission } from "@/lib/rate-limit";
import { looksLikeBot, type BotCheck } from "@/lib/bot-check";
import { parseInviteToken } from "@/lib/customer-invite";
import { EMAIL_REGEX, logAuthError, passwordProblem } from "@/lib/auth-input";
import { BUSINESS_PHONE, FIELD_MAX_LENGTHS } from "@/lib/constants";

// Customer sign-in, sign-up and password reset (the admin portal has its own in
// app/admin/auth-actions.ts). Every destination below is fixed, never read from
// the request. Errors never say whether an email has an account.

const GENERIC_ERROR = "Something went wrong. Please try again.";
const RATE_LIMITED =
  "We've received several requests from your connection. Please try again in about an hour.";

export type AuthResult = { error?: string; needsConfirmation?: boolean };
export type SignUpResult = { error?: string; checkEmail?: true };

function validEmail(email: unknown): email is string {
  return (
    typeof email === "string" &&
    email.length <= FIELD_MAX_LENGTHS.email &&
    EMAIL_REGEX.test(email.trim())
  );
}

// Lands on our own routes even with Supabase's default email template. Supabase
// only honours it if it's in the project's allowed redirect URLs.
async function redirectUrl(path: "/auth/confirm" | "/auth/recovery") {
  const origin = (await headers()).get("origin");
  return origin ? `${origin}${path}` : undefined;
}

export async function customerSignIn(
  email: string,
  password: string,
  inviteToken?: string | null,
): Promise<AuthResult> {
  if (!validEmail(email) || typeof password !== "string" || password === "") {
    return { error: "Invalid email or password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error: "Confirm your email first. We sent you a link when you signed up.",
        needsConfirmation: true,
      };
    }
    if (error.code === "over_request_rate_limit") {
      return { error: "Too many attempts. Wait a few minutes and try again." };
    }
    return { error: "Invalid email or password." };
  }

  // Staff signing in here are sent to their own portal.
  if (data.user?.app_metadata?.role === "admin") redirect("/admin/dashboard");

  const { destination } = await completeCustomerSignIn(supabase, parseInviteToken(inviteToken));
  redirect(destination);
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  accountType: "residential" | "commercial";
  inviteToken?: string | null;
  botCheck: BotCheck;
}

export async function customerSignUp(input: SignUpInput): Promise<SignUpResult> {
  // Same bot gate as the booking forms: a generic error, nothing logged.
  if (typeof input !== "object" || input === null || looksLikeBot(input.botCheck)) {
    return { error: GENERIC_ERROR };
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name === "") return { error: "Enter your name." };
  if (name.length > FIELD_MAX_LENGTHS.name) return { error: "That name is too long." };
  if (!validEmail(input.email)) return { error: "Enter a valid email address." };
  const passwordError = passwordProblem(input.password);
  if (passwordError) return { error: passwordError };
  if (input.accountType !== "residential" && input.accountType !== "commercial") {
    return { error: GENERIC_ERROR };
  }

  let inviteToken: string | null = null;
  if (input.inviteToken) {
    inviteToken = parseInviteToken(input.inviteToken);
    if (!inviteToken) return { error: "This invite link isn't valid. Ask for a new one." };
  }

  if (!(await allowPublicSubmission("signup"))) return { error: RATE_LIMITED };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: await redirectUrl("/auth/confirm"),
      // Only a label for the account the first sign-in creates; records are
      // matched by the confirmed email, never by this. The invite token rides
      // along so confirming on another device still joins the business.
      data: {
        name,
        account_type: input.accountType,
        ...(inviteToken ? { invite_token: inviteToken } : {}),
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") return { error: error.message };
    if (error.code === "over_email_send_rate_limit") {
      return { error: "Too many emails were requested. Wait a few minutes and try again." };
    }
    if (error.code === "signup_disabled") {
      // Sign-ups are switched off in the Supabase project. Logged so the owner can
      // find it, and worded so a customer knows it isn't their mistake.
      logAuthError("customerSignUp", error);
      return {
        error: `Creating an account isn't available right now. You can still book, or call us at ${BUSINESS_PHONE.display}.`,
      };
    }
    logAuthError("customerSignUp", error);
    return { error: GENERIC_ERROR };
  }

  // Email confirmation is off (local development): there's a session already.
  if (data.session) {
    const { destination } = await completeCustomerSignIn(supabase, inviteToken);
    redirect(destination);
  }

  // The same answer whether or not the address already has an account.
  return { checkEmail: true };
}

/** Sends the confirmation email again. Never says whether the address has an account. */
export async function resendConfirmation(email: string): Promise<{ error?: string }> {
  if (!validEmail(email)) return { error: "Enter a valid email address." };
  if (!(await allowPublicSubmission("signup"))) return { error: RATE_LIMITED };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: await redirectUrl("/auth/confirm") },
  });

  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return { error: "Too many emails were requested. Wait a few minutes and try again." };
    }
    logAuthError("resendConfirmation", error);
    return { error: GENERIC_ERROR };
  }
  return {};
}

/**
 * Emails a password reset link. The result never says whether an account exists
 * for the address.
 */
export async function requestCustomerPasswordReset(email: string): Promise<{ error?: string }> {
  if (!validEmail(email)) return { error: "Enter a valid email address." };
  if (!(await allowPublicSubmission("reset"))) return { error: RATE_LIMITED };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: await redirectUrl("/auth/recovery"),
  });

  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return { error: "Too many reset emails were requested. Wait a few minutes and try again." };
    }
    logAuthError("requestCustomerPasswordReset", error);
    return { error: GENERIC_ERROR };
  }
  return {};
}

/** Sets a new password for the signed-in customer (the reset link signs them in for this). */
export async function updateCustomerPassword(password: string): Promise<{ error?: string }> {
  const auth = await requireCustomer();
  if (!auth.ok) return { error: "Your reset link has expired. Request a new one." };

  const passwordError = passwordProblem(password);
  if (passwordError) return { error: passwordError };

  const { error } = await auth.supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return { error: "Choose a password you haven't used for this account." };
    }
    if (error.code === "weak_password") return { error: error.message };
    logAuthError("updateCustomerPassword", error);
    return { error: GENERIC_ERROR };
  }

  redirect("/account");
}

export async function customerSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
