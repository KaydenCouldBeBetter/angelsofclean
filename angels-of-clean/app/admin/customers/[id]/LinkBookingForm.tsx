"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkBookingToAccount } from "../actions";
import { Field, FormError, INPUT_CLASS, SECONDARY_BUTTON } from "./form-ui";

// For a booking made under a different email, which the automatic link by email
// can't match. Only a booking that isn't on any account can be linked.
export default function LinkBookingForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await linkBookingToAccount(accountId, number);
      if (result.success) {
        setNumber("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-[#e2e8e6] pt-4">
      <Field
        id="link-booking"
        label="Link another booking"
        hint="For a booking made under a different email, such as a spouse or front desk."
      >
        <div className="flex gap-2">
          <input
            id="link-booking"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="AOC-1043"
            autoComplete="off"
            className={INPUT_CLASS}
          />
          <button type="submit" disabled={isPending || number.trim() === ""} className={SECONDARY_BUTTON}>
            {isPending ? "Linking…" : "Link"}
          </button>
        </div>
      </Field>
      {error && <FormError>{error}</FormError>}
    </form>
  );
}
