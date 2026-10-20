import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Service-role client: bypasses RLS entirely. Only ever import this from the
// public submit actions (app/actions/submitBooking.ts and
// submitCommercialQuote.ts), after their own validation has passed — there is
// no public INSERT policy on `bookings` or `commercial_quotes`, so these are
// the only insert paths — and from lib/rate-limit.ts, which counts attempts
// against those same paths.
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
