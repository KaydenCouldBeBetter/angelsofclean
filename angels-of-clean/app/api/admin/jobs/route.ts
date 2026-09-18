import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, NOT_SIGNED_IN_ERROR } from "@/lib/supabase/require-admin";
import { getJobsInRange } from "@/lib/supabase/queries";

export async function GET(req: NextRequest) {
  // Verify the user is a signed-in admin, not just any authenticated account.
  const auth = await requireAdmin();

  if (!auth.ok) {
    const status = auth.error === NOT_SIGNED_IN_ERROR ? 401 : 403;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing 'from' and 'to' query params (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const jobs = await getJobsInRange(from, to);
  return NextResponse.json(jobs);
}
