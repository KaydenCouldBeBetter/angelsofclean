import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";

// Public bookings allowed per client IP per window. A household books once;
// this leaves room for corrections and for a few customers sharing one IP.
export const BOOKING_RATE_LIMIT = { limit: 5, windowSeconds: 60 * 60 };

// Assumes the host overwrites these headers with the real client address (as
// Vercel does). Behind a proxy that only appends to x-forwarded-for, the first
// entry is caller-supplied and this limit can be dodged.
async function clientIp(): Promise<string> {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

// IP addresses are personal data, so the database only ever sees a keyed hash.
// The key is a server-only secret that already exists; a plain hash of an IPv4
// address could be reversed by trying all four billion of them.
function bucketFor(ip: string): string {
  const hash = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(ip)
    .digest("hex");
  return `booking:${hash}`;
}

/**
 * Counts one public booking attempt against the caller's IP. Returns false
 * once that IP has used up BOOKING_RATE_LIMIT for the current window.
 */
export async function allowPublicBooking(): Promise<boolean> {
  // Don't lock a developer out of their own form while testing locally.
  if (process.env.NODE_ENV === "development") return true;

  let code = "unknown";
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket: bucketFor(await clientIp()),
      p_limit: BOOKING_RATE_LIMIT.limit,
      p_window_seconds: BOOKING_RATE_LIMIT.windowSeconds,
    });

    if (!error && typeof data === "boolean") return data;
    code = error?.code ?? code;
  } catch {
    // Handled below, the same as an error result.
  }

  // Fail open: a broken limiter (e.g. supabase/004_rate_limits.sql not yet
  // run) must not stop real customers from booking.
  console.error("allowPublicBooking failed", { code, correlationId: crypto.randomUUID() });
  return true;
}
