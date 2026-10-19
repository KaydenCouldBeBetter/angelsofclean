import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/supabase/auth-timeout";

export const NOT_SIGNED_IN_ERROR = "You must be signed in to do this.";
export const NOT_AUTHORIZED_ERROR = "You are not authorized to do this.";
export const AUTH_UNAVAILABLE_ERROR = "We couldn't verify your sign-in. Try again.";

export type AdminContext = {
  ok: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
};

export type AdminAuthResult = AdminContext | { ok: false; error: string };

// Middleware only guards /admin page loads — server actions are directly
// callable HTTP endpoints, so each admin action must verify the session
// itself. `auth.getUser()` validates the token against Supabase Auth rather
// than trusting the cookie contents, so it also catches a session revoked
// before its token expires (middleware's getClaims() can't). The role check
// reads app_metadata, which only the Supabase dashboard or service role can
// set — never the client (user_metadata, by contrast, is client-editable).
// If Auth doesn't answer in time the action is refused with a retry message
// rather than left hanging (see auth-timeout.ts).
export async function requireAdmin(): Promise<AdminAuthResult> {
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
  if (user.app_metadata?.role !== "admin") {
    return { ok: false, error: NOT_AUTHORIZED_ERROR };
  }
  return { ok: true, supabase, user };
}
