import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeCustomerSignIn } from "@/lib/supabase/customer-session";
import { parseInviteToken } from "@/lib/customer-invite";

// The link in the sign-up confirmation email lands here. Verifying it confirms
// the email and signs the customer in; then any invite they signed up with is
// accepted and their bookings are claimed. The destination is fixed, never taken
// from the URL, so the link can't be turned into a redirect to another site.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();
  let verified = false;

  if (tokenHash && (type === "signup" || type === "email")) {
    // Custom email template ({{ .TokenHash }}): works on any device.
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    verified = !error;
  } else if (code) {
    // Supabase's default template: Supabase confirms the email first, then sends
    // the browser here with a code. Exchanging it only works in the browser that
    // signed up (the matching code verifier is a cookie there); anywhere else the
    // email is confirmed but there's no session, so the login page says so.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
  }

  if (!verified) redirect("/login?notice=confirm-failed");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { destination } = await completeCustomerSignIn(
    supabase,
    parseInviteToken(user?.user_metadata?.invite_token),
  );
  redirect(destination);
}
