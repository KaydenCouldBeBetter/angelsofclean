// The name the admin sidebar shows. It comes from user_metadata, which the
// signed-in user can edit, so it is for display only and never decides access.

/** Fired on `window` when Settings saves a new name, with the label to show as `detail`. */
export const ADMIN_DISPLAY_NAME_EVENT = "admin-display-name-changed";

/** The saved full name, else the old `name` field, else the start of the email address. */
export function displayNameFor(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata ?? {};
  const named = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  return named?.trim() || user.email?.split("@")[0] || "Admin";
}
