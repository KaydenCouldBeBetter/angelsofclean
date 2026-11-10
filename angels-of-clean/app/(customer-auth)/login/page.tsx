import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/supabase/session-role";
import { parseInviteToken } from "@/lib/customer-invite";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

// Why the visitor is here instead of where they were going. A fixed list, so the
// address bar can't put words in the page.
const NOTICES = {
  "confirm-failed":
    "We couldn't sign you in from that link. If you already confirmed your email, log in below.",
  unavailable: "We couldn't verify your sign-in. Log in again to continue.",
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; notice?: string }>;
}) {
  const { invite, notice } = await searchParams;
  const inviteToken = parseInviteToken(invite);

  // An invite link is followed only by a deliberate sign-in, never on page load,
  // so a signed-in visitor who opens one still sees the form.
  if (!inviteToken) {
    const role = await getSessionRole();
    if (role === "admin") redirect("/admin/dashboard");
    if (role === "customer") redirect("/account");
  }

  const noticeText = notice && notice in NOTICES ? NOTICES[notice as keyof typeof NOTICES] : null;
  return <LoginForm inviteToken={inviteToken} notice={noticeText} />;
}
