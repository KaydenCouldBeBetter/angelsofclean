import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin,
  AUTH_UNAVAILABLE_ERROR,
  NOT_SIGNED_IN_ERROR,
} from "@/lib/supabase/require-admin";
import { getJobsInRange } from "@/lib/supabase/queries";
import { isValidDateStr } from "@/lib/datetime";

export async function GET(req: NextRequest) {
  // Verify the user is a signed-in admin, not just any authenticated account.
  const auth = await requireAdmin();

  // Auth not answering is an outage, not a refusal (same as a failed query).
  if (!auth.ok && auth.error === AUTH_UNAVAILABLE_ERROR) {
    return NextResponse.json({ error: "Could not verify sign-in" }, { status: 503 });
  }

  if (!auth.ok) {
    const status = auth.error === NOT_SIGNED_IN_ERROR ? 401 : 403;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // A malformed date is the caller's mistake (400), not an outage (503).
  if (!from || !to || !isValidDateStr(from) || !isValidDateStr(to)) {
    return NextResponse.json(
      { error: "Missing 'from' and 'to' query params (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const jobs = await getJobsInRange(from, to);

  // A failed query must not look like an empty range to the calendar.
  if (!jobs.ok) {
    return NextResponse.json({ error: "Could not load jobs" }, { status: 503 });
  }

  // Customer names and addresses: never kept by a browser or shared cache.
  return NextResponse.json(jobs.data, { headers: { "Cache-Control": "private, no-store" } });
}
