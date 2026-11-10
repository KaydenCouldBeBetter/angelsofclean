import Link from "next/link";
import AuthAlert from "@/components/auth/AuthAlert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { parseInviteNotice } from "@/lib/supabase/customer-session";
import { customerSignOut } from "@/app/(customer-auth)/actions";

const INVITE_MESSAGES = {
  invalid: "That invite link has expired or was already used. Ask the account owner for a new one.",
  wrong_email: "That invite was sent to a different email address than the one you signed in with.",
  unverified: "Confirm your email address, then open the invite link again.",
  already_in_account:
    "You already have an account with bookings, so you can't join another one with this email. Ask the owner to invite a different address.",
  error: "We couldn't use that invite link. Please try again.",
} as const;

// Placeholder landing for Phase 2 (sign-in): proves the session works and shows
// which account the customer belongs to. The portal itself (overview, visits,
// billing) replaces it in the next phases.
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const notice = parseInviteNotice(invite);

  const supabase = await createClient();
  // Picks up bookings made after sign-up. Idempotent.
  await supabase.rpc("claim_account_records");
  const { data: account } = await supabase.from("accounts").select("name, account_type").maybeSingle();

  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">
        {account ? `Welcome, ${account.name}` : "Welcome"}
      </h1>
      {notice && <AuthAlert tone="info">{INVITE_MESSAGES[notice]}</AuthAlert>}
      <p className="text-sm text-ink-muted">
        You&apos;re signed in. Your bookings and billing will appear here.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink hover:bg-surface-tint"
        >
          Back to the site
        </Link>
        <form action={customerSignOut}>
          <Button type="submit" variant="outline" className="h-11 px-4">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
