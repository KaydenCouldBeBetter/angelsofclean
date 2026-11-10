"use client";

import { useState, useTransition } from "react";
import AuthAlert from "@/components/auth/AuthAlert";
import AuthField from "@/components/auth/AuthField";
import { Button } from "@/components/ui/button";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { updateCustomerPassword } from "../actions";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMismatch(false);

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setMismatch(true);
      return;
    }

    startTransition(async () => {
      // On success the action redirects to the account page.
      const result = await updateCustomerPassword(password);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold leading-tight text-ink">Choose a new password</h1>
        <p className="mt-1 text-sm text-ink-muted">You&apos;ll be signed in once it&apos;s saved.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <AuthField
          id="new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <AuthField
          id="confirm-password"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          error={mismatch ? "The two passwords don't match." : null}
        />

        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
          {isPending ? "Saving…" : "Save Password"}
        </Button>
      </form>
    </div>
  );
}
