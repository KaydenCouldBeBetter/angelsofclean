import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionRole } from "@/lib/supabase/session-role";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the reset email, which signs the customer in for this purpose.
// Without a session there is nothing to reset, so send them to ask for a new link.
export default async function ResetPasswordPage() {
  if ((await getSessionRole()) === null) redirect("/forgot-password?error=link");
  return <ResetPasswordForm />;
}
