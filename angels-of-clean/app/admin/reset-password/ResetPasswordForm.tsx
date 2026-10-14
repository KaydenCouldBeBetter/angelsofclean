"use client";

import { useState, useTransition } from "react";
import { updatePassword } from "../auth-actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setError("The two passwords don't match.");
      return;
    }

    startTransition(async () => {
      // On success the action redirects to the dashboard.
      const result = await updatePassword(password);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Choose a new password</h2>
        <p className="text-sm text-zinc-600 mt-1">You&apos;ll be signed in once it&apos;s saved.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-zinc-700 mb-1">
            New Password
          </label>
          <input
            id="new-password"
            type="password"
            required
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            aria-describedby="new-password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 rounded-lg border border-zinc-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5a]"
          />
          <p id="new-password-hint" className="text-xs text-zinc-600 mt-1">
            At least {PASSWORD_MIN_LENGTH} characters.
          </p>
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-zinc-700 mb-1">
            Confirm New Password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="w-full h-12 rounded-lg border border-zinc-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5a]"
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-[52px] rounded-lg bg-[#1a6b5a] text-white text-base font-semibold hover:bg-[#155a4b] transition-colors disabled:opacity-50 mt-1"
        >
          {isPending ? "Saving…" : "Save Password"}
        </button>
      </form>
    </div>
  );
}
