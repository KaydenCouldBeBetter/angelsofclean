import AuthShell from "../AuthShell";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell>
      <ForgotPasswordForm linkFailed={error === "link"} />
    </AuthShell>
  );
}
