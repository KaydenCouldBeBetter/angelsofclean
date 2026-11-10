"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import AuthAlert from "@/components/auth/AuthAlert";
import AuthDivider from "@/components/auth/AuthDivider";
import AuthField from "@/components/auth/AuthField";
import HoneypotField from "@/components/booking/HoneypotField";
import Selectable, { SelectableGroup } from "@/components/booking/Selectable";
import { Button, buttonVariants } from "@/components/ui/button";
import { FIELD_MAX_LENGTHS, PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { EMAIL_REGEX } from "@/lib/auth-input";
import { cn } from "@/lib/utils";
import { customerSignUp, resendConfirmation } from "../actions";

type AccountType = "residential" | "commercial";

export default function SignupForm({ inviteToken }: { inviteToken: string | null }) {
  const [accountType, setAccountType] = useState<AccountType>("residential");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [touched, setTouched] = useState({ name: false, email: false, password: false });
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const startedAt = useRef<number | null>(null);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);

  // Fill time for the bot check, on this device's own clock.
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // The form is replaced by the confirmation, so move focus to it.
  useEffect(() => {
    if (sentTo) sentHeadingRef.current?.focus();
  }, [sentTo]);

  const isBusiness = accountType === "commercial" && !inviteToken;
  const nameProblem = name.trim() === "" ? (isBusiness ? "Business name is required." : "Full name is required.") : null;
  const emailProblem =
    email.trim() === ""
      ? "Email address is required."
      : !EMAIL_REGEX.test(email.trim())
        ? "Please enter a valid email address."
        : null;
  const passwordTooShort = password.length < PASSWORD_MIN_LENGTH;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTouched({ name: true, email: true, password: true });
    if (nameProblem || emailProblem || passwordTooShort) return;

    startTransition(async () => {
      const result = await customerSignUp({
        name,
        email,
        password,
        accountType: inviteToken ? "residential" : accountType,
        inviteToken,
        botCheck: { website, elapsedMs: Date.now() - (startedAt.current ?? Date.now()) },
      });
      // With email confirmation off the action redirects, so this is a failure
      // or the "check your email" answer.
      if (result?.error) setError(result.error);
      else if (result?.checkEmail) setSentTo(email.trim());
    });
  }

  function handleResend() {
    setResent(null);
    startTransition(async () => {
      const result = await resendConfirmation(sentTo ?? "");
      if (result.error) setError(result.error);
      else setResent("If that address is waiting for confirmation, we're sending a new link.");
    });
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <h1
          ref={sentHeadingRef}
          tabIndex={-1}
          className="text-center text-2xl font-bold leading-tight text-ink"
        >
          Check your email
        </h1>
        <p className="text-sm text-ink-muted">
          We&apos;re sending a confirmation link to{" "}
          <span className="font-medium text-ink">{sentTo}</span>. It can take a few minutes, so
          check your spam folder too. Opening the link confirms your email and signs you in.
        </p>
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        {resent && <AuthAlert tone="info">{resent}</AuthAlert>}
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full text-base"
          onClick={handleResend}
          disabled={isPending}
        >
          Send the link again
        </Button>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-primary hover:underline"
        >
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold leading-tight text-ink">Create your account</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Save time on future bookings. No account is required to book.
        </p>
      </div>

      {inviteToken && (
        <AuthAlert tone="info">
          You&apos;ve been invited to join a business account. Sign up with the email address the
          invite was sent to.
        </AuthAlert>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {!inviteToken && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-ink">This account is for</legend>
            <SelectableGroup type="radio" aria-label="Account type" className="grid grid-cols-2 gap-3">
              <Selectable
                value="residential"
                selected={accountType === "residential"}
                onSelect={() => setAccountType("residential")}
                className="flex min-h-14 items-center justify-center px-3 text-center"
              >
                My home
              </Selectable>
              <Selectable
                value="commercial"
                selected={accountType === "commercial"}
                onSelect={() => setAccountType("commercial")}
                className="flex min-h-14 items-center justify-center px-3 text-center"
              >
                My business
              </Selectable>
            </SelectableGroup>
          </fieldset>
        )}

        <AuthField
          id="name"
          label={isBusiness ? "Business name" : "Full name"}
          autoComplete={isBusiness ? "organization" : "name"}
          required
          maxLength={FIELD_MAX_LENGTHS.name}
          placeholder={isBusiness ? "Enter your business name" : "Enter your full name"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          error={touched.name ? nameProblem : null}
        />

        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          maxLength={FIELD_MAX_LENGTHS.email}
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={touched.email ? emailProblem : null}
        />

        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Create a password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters. A mix of letters and numbers is best.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={touched.password && passwordTooShort ? `Use at least ${PASSWORD_MIN_LENGTH} characters.` : null}
        />

        <HoneypotField value={website} onChange={setWebsite} />

        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <p className="text-xs text-ink-muted">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="font-medium text-primary underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          and confirm you&apos;ve read our{" "}
          <Link href="/privacy" className="font-medium text-primary underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>

        <Button type="submit" disabled={isPending} className="h-12 w-full text-base font-semibold">
          {isPending ? "Creating account…" : "Create Account"}
        </Button>
      </form>

      <AuthDivider />

      <Link
        href="/"
        className={cn(buttonVariants({ variant: "outline" }), "h-12 w-full text-base text-ink-muted")}
      >
        Continue without an account
      </Link>

      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link
          href={inviteToken ? `/login?invite=${inviteToken}` : "/login"}
          className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
