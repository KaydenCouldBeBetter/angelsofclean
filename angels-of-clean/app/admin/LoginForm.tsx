"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "./auth-actions";
import AuthShell from "./AuthShell";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signIn(email, password);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jordan@angelsofclean.com"
            className="w-full h-12 rounded-lg border border-zinc-300 px-3 text-sm"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full h-12 rounded-lg border border-zinc-300 px-3 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-[52px] rounded-lg bg-primary text-white text-base font-semibold hover:bg-primary-pressed transition-colors disabled:opacity-50 mt-1"
        >
          {isPending ? "Signing In…" : "Sign In"}
        </button>
      </form>

      <p className="text-center mt-4">
        <Link
          href="/admin/forgot-password"
          className="text-sm text-primary font-medium hover:underline"
        >
          Forgot password?
        </Link>
      </p>
    </AuthShell>
  );
}
