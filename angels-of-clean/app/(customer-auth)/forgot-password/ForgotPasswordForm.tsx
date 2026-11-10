"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import AuthAlert from "@/components/auth/AuthAlert";
import AuthField from "@/components/auth/AuthField";
import { Button } from "@/components/ui/button";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";
import { requestCustomerPasswordReset } from "../actions";

export default function ForgotPasswordForm({ linkFailed }: { linkFailed: boolean }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);

  // The form is replaced by the confirmation, so move focus to it.
  useEffect(() => {
    if (sentTo) sentHeadingRef.current?.focus();
  }, [sentTo]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestCustomerPasswordReset(email);
      if (result.error) setError(result.error);
      else setSentTo(email.trim());
    });
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <h1
          ref={sentHeadingRef}
          tabIndex={-1}
          className="text-center text-2xl font-bold leading-tight text-ink"
        >
          Check your email
        </h1>
        <p className="text-sm text-ink-muted">
          If <span className="font-medium text-ink">{sentTo}</span> has an account, we&apos;re
          sending it a link to choose a new password. The link works once. Check your spam folder
          if it doesn&apos;t arrive in a few minutes.
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary hover:underline"
        >
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold leading-tight text-ink">Reset your password</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>
      </div>

      {linkFailed && (
        <AuthAlert tone="error">
          That reset link has expired or was already used. Request a new one below.
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

        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
          {isPending ? "Sending…" : "Send Reset Link"}
        </Button>
      </form>

      <Link
        href="/login"
        className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary hover:underline"
      >
        Back to log in
      </Link>
    </div>
  );
}
