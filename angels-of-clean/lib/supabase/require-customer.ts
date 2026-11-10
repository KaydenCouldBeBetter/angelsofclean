import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/supabase/auth-timeout";
import {
  AUTH_UNAVAILABLE_ERROR,
  NOT_SIGNED_IN_ERROR,
} from "@/lib/supabase/require-admin";

export type CustomerContext = {
  ok: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
};

export type CustomerAuthResult = CustomerContext | { ok: false; error: string };

// The customer portal's counterpart to requireAdmin: any signed-in user, because
// every customer is one. It grants nothing by itself. What a customer can read
// comes from RLS (private.is_account_member on every customer policy), never
// from this check, and it never opens an admin surface (those need the
// app_metadata.role = 'admin' claim, which requireAdmin checks).
//
// proxy.ts only guards /account page loads. Server actions are directly callable
// HTTP endpoints, so each customer action verifies the session itself.
// getUser() validates the token with Supabase Auth, so it also catches a revoked
// session, and it is bounded by the same 4 s timeout: if Auth doesn't answer, the
// action is refused with a retry message.
export async function requireCustomer(): Promise<CustomerAuthResult> {
  const supabase = await createClient();
  const call = await withAuthTimeout(supabase.auth.getUser());
  if (call.timedOut || isAuthRetryableFetchError(call.value.error)) {
    return { ok: false, error: AUTH_UNAVAILABLE_ERROR };
  }

  const {
    data: { user },
    error,
  } = call.value;

  if (error || !user) return { ok: false, error: NOT_SIGNED_IN_ERROR };
  return { ok: true, supabase, user };
}
