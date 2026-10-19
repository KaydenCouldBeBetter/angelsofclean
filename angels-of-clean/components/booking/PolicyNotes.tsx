import Link from "next/link";

const LINK_CLASS = "font-medium text-primary underline underline-offset-2";

// Shown under the contact fields on both flows.
export function PrivacyNote() {
  return (
    <p className="text-xs text-zinc-500">
      We don&apos;t sell your information. Our{" "}
      <Link href="/privacy" className={LINK_CLASS}>
        Privacy Policy
      </Link>{" "}
      explains how we use and protect it.
    </p>
  );
}

// Shown above the submit button on both review steps. `action` is the button label.
export function AgreementNote({ action }: { action: string }) {
  return (
    <p className="text-xs text-zinc-500">
      By selecting {action}, you agree to our{" "}
      <Link href="/terms" className={LINK_CLASS}>
        Terms of Service
      </Link>{" "}
      and confirm you&apos;ve read our{" "}
      <Link href="/privacy" className={LINK_CLASS}>
        Privacy Policy
      </Link>
      .
    </p>
  );
}
