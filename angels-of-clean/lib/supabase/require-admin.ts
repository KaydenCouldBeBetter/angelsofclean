import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const NOT_SIGNED_IN_ERROR = "You must be signed in to do this.";
export const NOT_AUTHORIZED_ERROR = "You are not authorized to do this.";

export type AdminContext = {
  ok: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
};

export type AdminAuthResult = AdminContext | { ok: false; error: string };

// Middleware only guards /admin page loads — server actions are directly
// callable HTTP endpoints, so each admin action must verify the session
// itself. `auth.getUser()` validates the token against Supabase Auth rather
// than trusting the cookie contents. The role check reads app_metadata,
// which only the Supabase dashboard or service role can set — never the
// client (user_metadata, by contrast, is client-editable).
export async function requireAdmin(): Promise<AdminAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { ok: false, error: NOT_SIGNED_IN_ERROR };
  if (user.app_metadata?.role !== "admin") {
    return { ok: false, error: NOT_AUTHORIZED_ERROR };
  }
  return { ok: true, supabase, user };
}
