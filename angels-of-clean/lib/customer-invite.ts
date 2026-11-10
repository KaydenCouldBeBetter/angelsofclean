import { createHash, randomBytes } from "node:crypto";

// Invite links for commercial accounts: /signup?invite=<token>. The token is
// random, shown once to the account owner, and never stored: the database keeps
// only its SHA-256 hex (account_invites.token_hash), so a leaked table can't be
// turned back into working links. An invite also only works for the email it was
// issued to, once that email is confirmed.

// 32 random bytes as base64url is always 43 characters.
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The token if it has the shape we issue, otherwise null. Never throws. */
export function parseInviteToken(value: unknown): string | null {
  return typeof value === "string" && INVITE_TOKEN_PATTERN.test(value) ? value : null;
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
