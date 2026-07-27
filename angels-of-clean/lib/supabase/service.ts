import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Service-role client: bypasses RLS entirely. Only ever import this from
// app/actions/submitBooking.ts, after that action's own validation has passed —
// there is no public INSERT policy on `bookings`, so this is the only insert path.
// Never import this into client-facing code; the key is server-only (no NEXT_PUBLIC_ prefix).
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
