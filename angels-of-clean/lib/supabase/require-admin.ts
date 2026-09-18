import { createClient } from "@/lib/supabase/server";

// Middleware only guards /admin page loads — server actions are directly
// callable HTTP endpoints, so each admin action must verify the session
// itself. `auth.getUser()` validates the token against Supabase Auth rather
// than trusting the cookie contents.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { supabase, user };
}

export type AdminContext = NonNullable<Awaited<ReturnType<typeof requireAdmin>>>;
