import AuthShell from "../AuthShell";
import ResetPasswordForm from "./ResetPasswordForm";

// Reached from the reset email via ./confirm, which signs the admin in;
// middleware sends anyone without an admin session back to sign in.
export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
