import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The link in the reset email lands here. Verifying it signs the admin in for
// the reset, then sends them to choose a new password. The destination is
// fixed — never taken from the URL — so the link can't be turned into a
// redirect to another site.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();
  let verified = false;

  if (tokenHash && type === "recovery") {
    // Custom email template ({{ .TokenHash }}): works on any device.
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    verified = !error;
  } else if (code) {
    // Supabase's default template: only works in the browser that asked for
    // the reset, because the matching code verifier is a cookie there.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  }

  redirect(verified ? "/admin/reset-password" : "/admin/forgot-password?error=link");
}
