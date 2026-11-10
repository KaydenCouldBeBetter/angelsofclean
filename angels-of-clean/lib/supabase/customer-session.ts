import type { SupabaseClient } from "@supabase/supabase-js";
import { hashInviteToken } from "@/lib/customer-invite";
import { logAuthError } from "@/lib/auth-input";
import type { Database } from "@/lib/supabase/types";

// What /account?invite=<status> can say about an invite link that didn't join the
// customer to the account. "joined" and "already_member" aren't notices.
export const INVITE_NOTICE_STATUSES = [
  "invalid",
  "wrong_email",
  "unverified",
  "already_in_account",
  "error",
] as const;
export type InviteNotice = (typeof INVITE_NOTICE_STATUSES)[number];

export function parseInviteNotice(value: unknown): InviteNotice | null {
  return INVITE_NOTICE_STATUSES.find((status) => status === value) ?? null;
}

// The functions return jsonb, which the generated types call Json.
function statusOf(data: unknown): string | null {
  if (typeof data === "object" && data !== null && "status" in data) {
    const { status } = data as { status: unknown };
    return typeof status === "string" ? status : null;
  }
  return null;
}

/**
 * Runs once a customer has a verified session (password sign-in, or the link in
 * the confirmation email). Order matters: an invite is accepted before records
 * are claimed, so a person who signs up from an invite link joins the business
 * rather than being given an account of their own first (the database drops an
 * empty account of their own either way, but this keeps it from ever existing).
 *
 * Returns where to send them. The destination is fixed, never taken from the
 * request, so a sign-in link can't be turned into a redirect to another site.
 */
export async function completeCustomerSignIn(
  supabase: SupabaseClient<Database>,
  inviteToken: string | null,
): Promise<{ destination: string }> {
  let notice: InviteNotice | null = null;

  if (inviteToken) {
    const { data, error } = await supabase.rpc("accept_account_invite", {
      p_token_hash: hashInviteToken(inviteToken),
    });
    if (error) {
      logAuthError("accept_account_invite", error);
      notice = "error";
    } else {
      const status = statusOf(data);
      if (status !== "joined" && status !== "already_member") {
        notice = parseInviteNotice(status) ?? "error";
      } else {
        // The token has done its job; don't leave it in the user's profile.
        await supabase.auth.updateUser({ data: { invite_token: null } });
      }
    }
  }

  // Creates the account on first sign-in and links bookings and quotes made with
  // this (confirmed) email. Safe to repeat; the portal calls it again later to
  // pick up bookings made after sign-up. A failure isn't fatal: the portal shows
  // whatever the account already holds.
  const { error } = await supabase.rpc("claim_account_records");
  if (error) logAuthError("claim_account_records", error);

  return { destination: notice ? `/account?invite=${notice}` : "/account" };
}
