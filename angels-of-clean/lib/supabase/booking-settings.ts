import { createClient } from "./server";
import type { QueryResult } from "./queries";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// What the Settings page shows. Unlike the public rules (lib/booking-rules.ts),
// this includes the labels and the audit trail, so it is admin-session only.
export interface BookingSettings {
  paused: boolean;
  pauseMessage: string;
  minNoticeHours: number;
  maxDaysAhead: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface BlackoutDate {
  day: string; // "YYYY-MM-DD"
  label: string;
  createdBy: string | null;
}

export interface AuditEntry {
  id: string;
  description: string;
  actor: string | null;
  createdAt: string;
}

export interface BookingControls {
  settings: BookingSettings;
  blackouts: BlackoutDate[];
  audit: AuditEntry[];
}

const AUDIT_LIMIT = 20;

function logQueryError(source: string, error: { code?: string } | null | undefined) {
  console.error(`${source} failed`, {
    code: error?.code ?? "unknown",
    correlationId: crypto.randomUUID(),
  });
}

const SETTINGS_COLUMNS =
  "online_booking_paused,pause_message,min_notice_hours,max_days_ahead,updated_at,updated_by" as const;

function mapSettings(row: {
  online_booking_paused: boolean;
  pause_message: string;
  min_notice_hours: number;
  max_days_ahead: number;
  updated_at: string;
  updated_by: string | null;
}): BookingSettings {
  return {
    paused: row.online_booking_paused,
    pauseMessage: row.pause_message,
    minNoticeHours: row.min_notice_hours,
    maxDaysAhead: row.max_days_ahead,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/** Just the settings row; the dashboard uses this to show whether booking is paused. */
export async function getBookingSettings(): Promise<QueryResult<BookingSettings>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("booking_settings").select(SETTINGS_COLUMNS).maybeSingle();
  if (error || !data) {
    logQueryError("getBookingSettings", error);
    return { ok: false };
  }
  return { ok: true, data: mapSettings(data) };
}

/**
 * Everything the Settings page needs: the settings row, the upcoming blackout
 * dates (today onward, `today` is New York's) and the latest audit entries. All
 * three succeed or the whole read fails.
 */
export async function readBookingControls(
  supabase: SupabaseServerClient,
  today: string,
): Promise<QueryResult<BookingControls>> {
  const [settings, blackouts, audit] = await Promise.all([
    supabase.from("booking_settings").select(SETTINGS_COLUMNS).maybeSingle(),
    supabase
      .from("blackout_dates")
      .select("day,label,created_by")
      .gte("day", today)
      .order("day", { ascending: true }),
    supabase
      .from("settings_audit")
      .select("id,description,actor,created_at")
      .order("created_at", { ascending: false })
      .limit(AUDIT_LIMIT),
  ]);

  const failed = settings.error ?? blackouts.error ?? audit.error;
  if (failed || !settings.data) {
    logQueryError("readBookingControls", failed);
    return { ok: false };
  }
  return {
    ok: true,
    data: {
      settings: mapSettings(settings.data),
      blackouts: (blackouts.data ?? []).map((b) => ({ day: b.day, label: b.label, createdBy: b.created_by })),
      audit: (audit.data ?? []).map((a) => ({
        id: a.id,
        description: a.description,
        actor: a.actor,
        createdAt: a.created_at,
      })),
    },
  };
}

/**
 * How many bookings a New York day already has (cancelled ones don't count), so
 * an admin closing the day sees what is already scheduled. `{ ok: false }` on a
 * failed query, never a made-up zero.
 */
export async function countBookingsOnDate(
  supabase: SupabaseServerClient,
  day: string,
): Promise<QueryResult<number>> {
  const { count, error } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("scheduled_date", day)
    .neq("status", "cancelled");
  if (error || count === null) {
    logQueryError("countBookingsOnDate", error);
    return { ok: false };
  }
  return { ok: true, data: count };
}
