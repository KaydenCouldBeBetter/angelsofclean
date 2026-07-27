"use client";

import { useState, useTransition } from "react";
import { signIn } from "./auth-actions";

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
    <div className="min-h-screen flex flex-col bg-[#f5f5f5]">
      <div className="h-1 bg-[#1a6b5a]" />

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[400px] bg-white rounded-xl shadow-sm p-8">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a6b5a] flex items-center justify-center">
              <span className="text-white text-2xl font-bold">A</span>
            </div>
            <h1 className="mt-4 text-xl font-bold text-zinc-900">Angels of Clean</h1>
            <p className="text-sm text-zinc-500 mt-1">Admin Portal</p>
          </div>

          <div className="h-px bg-zinc-200 my-6" />

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
                className="w-full h-12 rounded-lg border border-zinc-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5a]"
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
                className="w-full h-12 rounded-lg border border-zinc-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6b5a]"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isPending}
              className="w-full h-[52px] rounded-lg bg-[#1a6b5a] text-white text-base font-semibold hover:bg-[#155a4b] transition-colors disabled:opacity-50 mt-1"
            >
              {isPending ? "Signing In…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-[#1a6b5a] font-medium mt-4 hover:underline cursor-pointer">
            Forgot password?
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-zinc-400 pb-6">
        Angels of Clean · Admin Access Only
      </p>
    </div>
  );
}
