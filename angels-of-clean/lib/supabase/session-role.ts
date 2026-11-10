import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { withAuthTimeout } from "@/lib/supabase/auth-timeout";

export type SessionRole = "admin" | "customer" | null;

// Who is looking at a public sign-in page, so a signed-in visitor can be sent
// on instead of seeing a form. It reads the verified token claims (no Auth round
// trip) and is only a convenience: anything uncertain (no session, a timeout, a
// network error) is "not signed in", so the form still shows and nothing is
// granted. Pages that show data never use this; they use proxy.ts and RLS.
export async function getSessionRole(): Promise<SessionRole> {
  try {
    const supabase = await createClient();
    const call = await withAuthTimeout(supabase.auth.getClaims());
    if (call.timedOut || isAuthRetryableFetchError(call.value.error)) return null;
    const claims = call.value.data?.claims;
    if (call.value.error || !claims) return null;
    return claims.app_metadata?.role === "admin" ? "admin" : "customer";
  } catch {
    return null;
  }
}
