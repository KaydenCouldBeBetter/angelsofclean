"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import AuthAlert from "@/components/auth/AuthAlert";
import AuthDivider from "@/components/auth/AuthDivider";
import AuthField from "@/components/auth/AuthField";
import { Button, buttonVariants } from "@/components/ui/button";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { customerSignIn, resendConfirmation } from "../actions";

export default function LoginForm({
  inviteToken,
  notice,
}: {
  inviteToken: string | null;
  notice: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResent(null);
    setNeedsConfirmation(false);
    startTransition(async () => {
      // On success the action redirects, so this only returns for a failure.
      const result = await customerSignIn(email, password, inviteToken);
      if (result?.error) {
        setError(result.error);
        setNeedsConfirmation(Boolean(result.needsConfirmation));
      }
    });
  }

  function handleResend() {
    setResent(null);
    startTransition(async () => {
      const result = await resendConfirmation(email);
      if (result.error) setError(result.error);
      else setResent("If that address is waiting for confirmation, we're sending a new link.");
    });
  }

  const signUpHref = inviteToken ? `/signup?invite=${inviteToken}` : "/signup";

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold leading-tight text-ink">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to manage your bookings.</p>
      </div>

      {notice && <AuthAlert tone="info">{notice}</AuthAlert>}
      {inviteToken && (
        <AuthAlert tone="info">
          You&apos;ve been invited to join a business account. Sign in with the email address the
          invite was sent to.
        </AuthAlert>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={FIELD_MAX_LENGTHS.email}
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="flex flex-col gap-2">
          <AuthField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center self-end text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {error && (
          <AuthAlert tone="error">
            <p>{error}</p>
            {needsConfirmation && (
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-11 px-4"
                onClick={handleResend}
                disabled={isPending}
              >
                Send the link again
              </Button>
            )}
          </AuthAlert>
        )}
        {resent && <AuthAlert tone="info">{resent}</AuthAlert>}

        <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
          {isPending ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <AuthDivider />

      <Link
        href="/"
        className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full text-base text-ink-muted")}
      >
        Continue as guest
      </Link>

      <p className="text-center text-sm text-ink-muted">
        Don&apos;t have an account?{" "}
        <Link
          href={signUpHref}
          className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
