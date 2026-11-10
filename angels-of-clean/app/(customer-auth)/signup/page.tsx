import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/supabase/session-role";
import { parseInviteToken } from "@/lib/customer-invite";
import SignupForm from "./SignupForm";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const inviteToken = parseInviteToken(invite);

  // As on the login page, an invite is only followed by a deliberate action.
  if (!inviteToken) {
    const role = await getSessionRole();
    if (role === "admin") redirect("/admin/dashboard");
    if (role === "customer") redirect("/account");
  }

  return <SignupForm inviteToken={inviteToken} />;
}
