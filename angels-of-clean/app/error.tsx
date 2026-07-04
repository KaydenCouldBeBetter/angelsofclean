"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white max-w-sm mx-auto px-4 text-center gap-6">
      <div className="w-16 h-16 rounded-full border-2 border-red-400 flex items-center justify-center">
        <span className="text-2xl text-red-500" role="img" aria-label="Error">!</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Something went wrong</h1>
        <p className="text-sm text-zinc-500 mt-2">
          An unexpected error occurred. Please try again.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <Button onClick={reset} className="w-full h-14">
          Try Again
        </Button>
        <Button
          variant="outline"
          className="w-full h-14"
          onClick={() => (window.location.href = "/")}
        >
          Return to Home
        </Button>
      </div>
    </div>
  );
}
