"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "../auth-actions";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";

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
      const result = await requestPasswordReset(email);
      if (result.error) setError(result.error);
      else setSentTo(email.trim());
    });
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-3">
        <h2
          ref={sentHeadingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-zinc-900 focus:outline-none"
        >
          Check your email
        </h2>
        <p className="text-sm text-zinc-600">
          If <span className="font-medium text-zinc-900">{sentTo}</span> belongs to an admin
          account, we&apos;ve sent it a link to reset your password. The link works once. Check
          your spam folder if it doesn&apos;t arrive in a few minutes.
        </p>
        <Link href="/admin" className="mt-2 text-sm text-[#1a6b5a] font-medium hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Reset your password</h2>
        <p className="text-sm text-zinc-600 mt-1">
          Enter your admin email and we&apos;ll send you a link to choose a new password.
        </p>
      </div>

      {linkFailed && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          That reset link has expired or was already used. Request a new one below.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            maxLength={FIELD_MAX_LENGTHS.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jordan@angelsofclean.com"
            className="w-full h-12 rounded-lg border border-zinc-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5a]"
          />
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-[52px] rounded-lg bg-[#1a6b5a] text-white text-base font-semibold hover:bg-[#155a4b] transition-colors disabled:opacity-50 mt-1"
        >
          {isPending ? "Sending…" : "Send Reset Link"}
        </button>
      </form>

      <Link href="/admin" className="text-center text-sm text-[#1a6b5a] font-medium hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
