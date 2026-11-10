"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, UserMinus, X } from "lucide-react";
import AuthAlert from "@/components/auth/AuthAlert";
import { Button } from "@/components/ui/button";
import { createTeamInvite, removeTeamMember, revokeTeamInvite } from "@/app/account/team/actions";
import type { PendingInvite, TeamMember } from "@/lib/customer-types";

// The owner's team page. A new invite's link is shown once, right after it is
// made (the server keeps only a hash), for the owner to copy and send.
export default function TeamManager({
  members,
  invites,
  currentEmail,
}: {
  members: TeamMember[];
  invites: PendingInvite[];
  currentEmail: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createTeamInvite(email);
      if (result.success) {
        setLink({ email: email.trim(), url: `${window.location.origin}/signup?invite=${result.token}` });
        setEmail("");
        router.refresh();
      } else {
        setLink(null);
        setError(result.error);
      }
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      // The link stays selectable in its field.
      setCopied(false);
    }
  }

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) setError(result.error ?? "Something went wrong. Please try again.");
      setConfirmRemove(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <AuthAlert tone="error">{error}</AuthAlert>}

      <section aria-labelledby="invite-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-white p-5">
        <h2 id="invite-heading" className="text-lg font-semibold text-ink">
          Invite someone
        </h2>
        <p className="text-sm text-ink-muted">
          Enter their work email. You&apos;ll get a link to send them. It works once, for that email, for 7 days.
        </p>
        <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="invite-email" className="text-sm font-medium text-ink">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-white px-3 text-base text-ink"
            />
          </div>
          <Button type="submit" disabled={isPending || email.trim() === ""} className="h-11 px-5 text-sm font-semibold">
            {isPending ? "Working…" : "Create invite link"}
          </Button>
        </form>

        {link && (
          <div role="status" className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-medium text-ink">
              Link for {link.email}. Copy it now: it can&apos;t be shown again.
            </p>
            <label htmlFor="invite-link" className="sr-only">
              Invite link
            </label>
            <input
              id="invite-link"
              readOnly
              value={link.url}
              onFocus={(e) => e.currentTarget.select()}
              className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink"
            />
            <Button type="button" onClick={copy} className="h-11 w-fit gap-2 px-5 text-sm font-semibold">
              <Copy aria-hidden="true" className="size-4" />
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="members-heading" className="flex flex-col gap-3">
        <h2 id="members-heading" className="text-lg font-semibold text-ink">
          Team
        </h2>
        <ul aria-label="Team members" className="flex flex-col gap-3">
          {members.map((member) => {
            const you = currentEmail !== null && member.email.toLowerCase() === currentEmail.toLowerCase();
            return (
              <li key={member.userId} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    {member.email}
                    {you && <span className="font-normal text-ink-muted"> (you)</span>}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {member.role === "owner" ? "Owner" : "Member"} · joined {member.joinedLabel}
                  </p>
                </div>
                {member.role === "member" &&
                  (confirmRemove === member.userId ? (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => run(() => removeTeamMember(member.userId))}
                        className="h-11 px-4 text-sm font-semibold"
                      >
                        Yes, remove {member.email}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setConfirmRemove(null)} className="h-11 px-4 text-sm">
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmRemove(member.userId)}
                      className="h-11 gap-2 px-4 text-sm font-semibold"
                    >
                      <UserMinus aria-hidden="true" className="size-4" />
                      Remove
                      <span className="sr-only"> {member.email}</span>
                    </Button>
                  ))}
              </li>
            );
          })}
        </ul>
      </section>

      {invites.length > 0 && (
        <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
          <h2 id="pending-heading" className="text-lg font-semibold text-ink">
            Pending invites
          </h2>
          <ul aria-label="Pending invites" className="flex flex-col gap-3">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{invite.email}</p>
                  <p className="text-sm text-ink-muted">
                    {invite.expired ? `Expired ${invite.expiresLabel}` : `Expires ${invite.expiresLabel}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => run(() => revokeTeamInvite(invite.id))}
                  className="h-11 gap-2 px-4 text-sm font-semibold"
                >
                  <X aria-hidden="true" className="size-4" />
                  {invite.expired ? "Remove" : "Cancel invite"}
                  <span className="sr-only"> for {invite.email}</span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
