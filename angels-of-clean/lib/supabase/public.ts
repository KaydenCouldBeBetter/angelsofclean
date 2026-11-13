import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// A signed-out client: the anon key, no cookies, no session. For the few
// database functions the public booking flow may call (get_booking_rules). It
// has exactly the privileges of any visitor, so nothing it can read needs
// protecting from it. The service-role client stays reserved for the public
// inserts; use this one for reads.
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
