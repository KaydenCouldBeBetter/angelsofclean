import { authRetryTarget, isAuthRetryParams } from "@/lib/supabase/auth-timeout";
import AuthShell from "./AuthShell";
import { ErrorAlert } from "./LoadError";
import LoginForm from "./LoginForm";

// Middleware has already checked the session for this request: it sends an
// admin on to the dashboard, and anyone it couldn't verify (Auth didn't answer
// in time) to ?auth=retry. So this page makes no auth call of its own.
export default async function AdminIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  if (isAuthRetryParams(params)) {
    return (
      <AuthShell>
        <ErrorAlert
          title="We couldn't verify your sign-in"
          message="This is a problem reaching our sign-in service, not your password. Try again in a moment."
        />
        {/* A full page load, so the browser shows it's working while
            middleware checks the session again. */}
        <a
          href={authRetryTarget(params.next)}
          className="mt-4 flex w-full h-[52px] items-center justify-center rounded-lg bg-[#1a6b5a] text-white text-base font-semibold hover:bg-[#155a4b] transition-colors"
        >
          Try again
        </a>
      </AuthShell>
    );
  }

  return <LoginForm />;
}
