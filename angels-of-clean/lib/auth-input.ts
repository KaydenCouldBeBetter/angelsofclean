import { PASSWORD_MIN_LENGTH } from "@/lib/constants";

// Input rules shared by the customer sign-up, sign-in and reset actions.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Supabase hashes passwords with bcrypt, which ignores everything past 72 bytes.
export const PASSWORD_MAX_BYTES = 72;

/** An error message for a password the form must refuse, or null if it's fine. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return "That password is too long. Use a shorter one.";
  }
  return null;
}

// Log only the auth error code plus a correlation id, never the email.
export function logAuthError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}
