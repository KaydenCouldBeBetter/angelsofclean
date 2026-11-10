import AuthAlert from "@/components/auth/AuthAlert";
import type { InviteNotice as InviteNoticeStatus } from "@/lib/supabase/customer-session";

const MESSAGES: Record<InviteNoticeStatus, string> = {
  invalid: "That invite link has expired or was already used. Ask the account owner for a new one.",
  wrong_email: "That invite was sent to a different email address than the one you signed in with.",
  unverified: "Confirm your email address, then open the invite link again.",
  already_in_account:
    "You already have an account with bookings, so you can't join another one with this email. Ask the owner to invite a different address.",
  error: "We couldn't use that invite link. Please try again.",
};

// Why an invite link didn't join the customer to a business account.
export default function InviteNotice({ status }: { status: InviteNoticeStatus }) {
  return <AuthAlert tone="info">{MESSAGES[status]}</AuthAlert>;
}
