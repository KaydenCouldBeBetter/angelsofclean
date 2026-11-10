import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The link in the customer password-reset email lands here. Verifying it signs
// the customer in for the reset, then sends them to choose a new password. The
// destination is fixed, never taken from the URL (the admin portal's reset has
// its own route under /admin).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();
  let verified = false;

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    verified = !error;
  } else if (code) {
    // Default template: only works in the browser that asked for the reset.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  }

  redirect(verified ? "/reset-password" : "/forgot-password?error=link");
}
