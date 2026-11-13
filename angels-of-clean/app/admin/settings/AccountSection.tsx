"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FIELD_MAX_LENGTHS, PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { ADMIN_DISPLAY_NAME_EVENT } from "@/lib/admin-display-name";
import { changePassword, saveDisplayName, signOutOtherDevices } from "./actions";
import SettingsCard from "./SettingsCard";

// The result line under a form: a polite status that is always in the page (so a
// screen reader announces it when the text appears) and an alert for a failure.
function Outcome({ message, error }: { message: string; error: string | null }) {
  return (
    <>
      <p role="status" className="text-sm text-primary-pressed">
        {message}
      </p>
      {error && (
        <p role="alert" className="rounded-lg border border-[#c0392b] bg-[#feefee] px-3 py-2 text-[13px] text-[#1c1c1e]">
          {error}
        </p>
      )}
    </>
  );
}

function DisplayNameForm({ email, initialName }: { email: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError(null);
    startTransition(async () => {
      const result = await saveDisplayName(name);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage("Name saved.");
      // Tell the sidebar, which read the old name when the page first loaded.
      const label = name.trim().replace(/\s+/g, " ") || email.split("@")[0] || "Admin";
      window.dispatchEvent(new CustomEvent(ADMIN_DISPLAY_NAME_EVENT, { detail: label }));
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="max-w-sm">
        <Label htmlFor="display-name" className="mb-1 text-[13px] text-[#1c1c1e]">
          Display name
        </Label>
        <Input
          id="display-name"
          autoComplete="name"
          maxLength={FIELD_MAX_LENGTHS.name}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setMessage("");
          }}
          aria-describedby={hintId}
          className="h-11"
        />
        <p id={hintId} className="mt-1 text-xs text-[#5c5c5e]">
          Shown at the bottom of the sidebar. Leave it blank to show the start of {email}.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={isPending} className="h-11 px-6 text-sm">
          {isPending ? "Saving..." : "Save name"}
        </Button>
        <Outcome message={message} error={error} />
      </div>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setError(null);
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    startTransition(async () => {
      const result = await changePassword({ currentPassword: current, newPassword: next });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage("Password changed. Other devices stay signed in until you sign them out.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold text-[#1c1c1e]">Change password</h3>
      <div className="flex max-w-sm flex-col gap-3">
        <div>
          <Label htmlFor="current-password" className="mb-1 text-[13px] text-[#1c1c1e]">
            Current password
          </Label>
          <Input
            id="current-password"
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="h-11"
          />
        </div>
        <div>
          <Label htmlFor="new-password" className="mb-1 text-[13px] text-[#1c1c1e]">
            New password
          </Label>
          <Input
            id="new-password"
            type="password"
            required
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-describedby={hintId}
            className="h-11"
          />
          <p id={hintId} className="mt-1 text-xs text-[#5c5c5e]">
            At least {PASSWORD_MIN_LENGTH} characters.
          </p>
        </div>
        <div>
          <Label htmlFor="confirm-password" className="mb-1 text-[13px] text-[#1c1c1e]">
            Confirm new password
          </Label>
          <Input
            id="confirm-password"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="h-11"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={isPending} className="h-11 px-6 text-sm">
          {isPending ? "Changing..." : "Change password"}
        </Button>
        <Outcome message={message} error={error} />
      </div>
    </form>
  );
}

function SignOutOthers() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setMessage("");
    setError(null);
    startTransition(async () => {
      const result = await signOutOtherDevices();
      if (result.success) setMessage("Every other device has been signed out.");
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-[13px] font-semibold text-[#1c1c1e]">Signed-in devices</h3>
        <p className="mt-0.5 text-xs text-[#5c5c5e]">
          Use this if you signed in on a shared or lost device. You stay signed in here.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" variant="outline" onClick={handleClick} disabled={isPending} className="h-11 px-6 text-sm">
          {isPending ? "Signing out..." : "Sign out other devices"}
        </Button>
        <Outcome message={message} error={error} />
      </div>
    </div>
  );
}

export default function AccountSection({ email, displayName }: { email: string; displayName: string }) {
  return (
    <SettingsCard id="account" title="Account & security" description={`Signed in as ${email}.`}>
      <DisplayNameForm email={email} initialName={displayName} />
      <div className="h-px bg-[#e2e8e6]" />
      <PasswordForm />
      <div className="h-px bg-[#e2e8e6]" />
      <SignOutOthers />
    </SettingsCard>
  );
}
