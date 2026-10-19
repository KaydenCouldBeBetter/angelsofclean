// Lightweight bot check for the public booking and quote submits (backlog B5).
// No third-party service: a hidden honeypot field that people never see or
// reach, plus a minimum fill time. Both are checked on the server.

// Name of the hidden field. Looks like something a form-filling script would
// want to complete; `autocomplete="off"` keeps browser autofill away from it.
export const HONEYPOT_FIELD_NAME = "website";

// A person needs far longer than this to get through the whole wizard.
export const MIN_FILL_MS = 3000;

export interface BotCheck {
  // Value of the hidden field. Always "" for a person.
  website: string;
  // Milliseconds from the first wizard step to the submit, measured on the
  // client's own clock, so a wrong device clock can't make a person look fast.
  elapsedMs: number;
}

// Server Action arguments come straight from the caller, so the shape is not
// trusted: a missing, malformed or filled-in value all count as a bot.
// This stops generic form-filling scripts. A script written for this site can
// still send "" and a large number; the rate limit is what bounds that.
export function looksLikeBot(check: unknown): boolean {
  if (typeof check !== "object" || check === null) return true;
  const { website, elapsedMs } = check as Record<string, unknown>;
  if (website !== "") return true;
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs)) return true;
  return elapsedMs < MIN_FILL_MS;
}
