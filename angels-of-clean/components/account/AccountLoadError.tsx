"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import AuthAlert from "@/components/auth/AuthAlert";
import { Button } from "@/components/ui/button";

// Fills a page when its data failed to load, so an outage never reads as "you
// have no visits". The wording says it is a connection problem, with a retry.
export default function AccountLoadError({ what }: { what: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <AuthAlert tone="error">
      <p className="font-semibold">We couldn&apos;t load {what}</p>
      <p className="mt-1">This is a problem reaching our system, not an empty list. Try again in a moment.</p>
      <Button
        type="button"
        variant="outline"
        className="mt-3 h-11 px-4"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {isPending ? "Trying…" : "Try again"}
      </Button>
    </AuthAlert>
  );
}
