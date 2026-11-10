"use server";

import { requireCustomer } from "@/lib/supabase/require-customer";
import { EMAIL_REGEX, logAuthError } from "@/lib/auth-input";
import { generateInviteToken, hashInviteToken } from "@/lib/customer-invite";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import { isUuid } from "@/lib/admin-customers";

// The business owner's team actions. Each checks the session, then calls a
// database function that checks ownership itself (create_account_invite,
// revoke_account_invite, remove_account_member): nothing here decides who may
// manage a team. Failures log only an error code.

export type TeamResult = { success: true } | { success: false; error: string };
export type InviteResult =
  | { success: true; token: string }
  | { success: false; error: string };

const GENERIC = "Something went wrong. Please try again.";

function statusOf(data: unknown): string | null {
  if (typeof data === "object" && data !== null && "status" in data) {
    const { status } = data as { status: unknown };
    return typeof status === "string" ? status : null;
  }
  return null;
}

const INVITE_ERRORS: Record<string, string> = {
  not_owner: "Only the account owner can invite people.",
  not_commercial: "Only business accounts can invite people.",
  invalid_email: "Enter a valid email address.",
  already_member: "That person is already on your team.",
  too_many: "You have too many pending invites. Cancel one first.",
};

/**
 * Makes an invite for an email and returns the link's token once. It is not
 * stored anywhere readable (only its hash is), so the owner copies the link now.
 */
export async function createTeamInvite(email: string): Promise<InviteResult> {
  const auth = await requireCustomer();
  if (!auth.ok) return { success: false, error: auth.error };

  const trimmed = typeof email === "string" ? email.trim() : "";
  if (trimmed === "" || trimmed.length > FIELD_MAX_LENGTHS.email || !EMAIL_REGEX.test(trimmed)) {
    return { success: false, error: "Enter a valid email address." };
  }

  const token = generateInviteToken();
  const { data, error } = await auth.supabase.rpc("create_account_invite", {
    p_token_hash: hashInviteToken(token),
    p_email: trimmed,
  });
  if (error) {
    logAuthError("create_account_invite", error);
    return { success: false, error: GENERIC };
  }

  const status = statusOf(data);
  if (status === "created") return { success: true, token };
  return { success: false, error: (status && INVITE_ERRORS[status]) || GENERIC };
}

export async function revokeTeamInvite(inviteId: string): Promise<TeamResult> {
  const auth = await requireCustomer();
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(inviteId)) return { success: false, error: GENERIC };

  const { data, error } = await auth.supabase.rpc("revoke_account_invite", { p_invite_id: inviteId });
  if (error) {
    logAuthError("revoke_account_invite", error);
    return { success: false, error: GENERIC };
  }
  const status = statusOf(data);
  if (status === "revoked") return { success: true };
  return { success: false, error: "That invite is no longer pending. Refresh the page." };
}

export async function removeTeamMember(userId: string): Promise<TeamResult> {
  const auth = await requireCustomer();
  if (!auth.ok) return { success: false, error: auth.error };
  if (!isUuid(userId)) return { success: false, error: GENERIC };

  const { data, error } = await auth.supabase.rpc("remove_account_member", { p_user_id: userId });
  if (error) {
    logAuthError("remove_account_member", error);
    return { success: false, error: GENERIC };
  }
  if (statusOf(data) === "removed") return { success: true };
  return { success: false, error: "That person can't be removed. Refresh the page." };
}
