import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";

// Public submissions of each kind allowed per client IP per window. A customer
// submits once; this leaves room for corrections and for a few customers
// sharing one IP.
export const SUBMISSION_RATE_LIMIT = { limit: 5, windowSeconds: 60 * 60 };

// Bookings and quote requests are counted separately.
export type SubmissionKind = "booking" | "quote";

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
function bucketFor(kind: SubmissionKind, ip: string): string {
  const hash = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(ip)
    .digest("hex");
  return `${kind}:${hash}`;
}

/**
 * Counts one public submission against the caller's IP. Returns false once
 * that IP has used up SUBMISSION_RATE_LIMIT for this kind in the current window.
 */
export async function allowPublicSubmission(kind: SubmissionKind): Promise<boolean> {
  // Don't lock a developer out of their own form while testing locally.
  if (process.env.NODE_ENV === "development") return true;

  let code = "unknown";
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_bucket: bucketFor(kind, await clientIp()),
      p_limit: SUBMISSION_RATE_LIMIT.limit,
      p_window_seconds: SUBMISSION_RATE_LIMIT.windowSeconds,
    });

    if (!error && typeof data === "boolean") return data;
    code = error?.code ?? code;
  } catch {
    // Handled below, the same as an error result.
  }

  // Fail open: a broken limiter (e.g. the rate_limits migration not yet
  // applied) must not stop real customers from booking.
  console.error("allowPublicSubmission failed", { code, correlationId: crypto.randomUUID() });
  return true;
}
