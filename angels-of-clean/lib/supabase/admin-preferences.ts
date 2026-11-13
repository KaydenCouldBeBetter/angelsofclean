import { createClient } from "./server";
import type { QueryResult } from "./queries";
import {
  DEFAULT_ADMIN_PREFERENCES,
  preferencesFromRow,
  type AdminPreferences,
} from "@/lib/admin-preferences";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Explicit column list: user_id and updated_at are never needed.
const PREFERENCE_COLUMNS =
  "landing_page,calendar_view,week_starts_on,calendar_start_hour,calendar_end_hour,unassigned_list_collapsed,bookings_default_filter" as const;

/**
 * The signed-in admin's own preferences. Row-level security lets an admin see
 * only their own row, so no id is passed; an admin who has never saved anything
 * has no row and gets the defaults. A failed query is `{ ok: false }`, never
 * mistaken for "no preferences saved".
 */
export async function readAdminPreferences(
  supabase: SupabaseServerClient,
): Promise<QueryResult<AdminPreferences>> {
  const { data, error } = await supabase
    .from("admin_preferences")
    .select(PREFERENCE_COLUMNS)
    .maybeSingle();

  if (error) {
    // Only the Postgres code and a correlation id, like every other query helper.
    console.error("getAdminPreferences failed", {
      code: error.code ?? "unknown",
      correlationId: crypto.randomUUID(),
    });
    return { ok: false };
  }
  return { ok: true, data: data ? preferencesFromRow(data) : DEFAULT_ADMIN_PREFERENCES };
}

export async function getAdminPreferences(): Promise<QueryResult<AdminPreferences>> {
  return readAdminPreferences(await createClient());
}

/**
 * For pages that only apply preferences (Calendar, Bookings, sign-in): if the
 * lookup fails the page still works, with the defaults, rather than showing an
 * error for something the admin didn't ask for.
 */
export async function getAdminPreferencesOrDefaults(): Promise<AdminPreferences> {
  try {
    const result = await getAdminPreferences();
    return result.ok ? result.data : DEFAULT_ADMIN_PREFERENCES;
  } catch {
    return DEFAULT_ADMIN_PREFERENCES;
  }
}
