// @vitest-environment node
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  BOOKINGS_FILTER_OPTIONS,
  CALENDAR_VIEW_OPTIONS,
  DEFAULT_ADMIN_PREFERENCES,
  FIRST_HOUR_RANGE,
  LANDING_PAGE_OPTIONS,
  LAST_HOUR_RANGE,
  MIN_VISIBLE_HOURS,
  WEEK_START_OPTIONS,
} from "@/lib/admin-preferences";

// The admin_preferences table repeats the app's allowed values and defaults as
// CHECK constraints and column defaults. This reads the migration and fails if
// either side changes without the other.
const MIGRATION = path.resolve(__dirname, "..", "migrations", "20261113202614_admin_preferences.sql");
const sql = readFileSync(MIGRATION, "utf8")
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ");

function columnDefault(column: string): string {
  const match = new RegExp(`${column} (?:text|smallint|boolean) not null default ('[a-z]+'|\\d+|true|false)`).exec(sql);
  if (!match) throw new Error(`No default found for ${column}`);
  return match[1].replace(/'/g, "");
}

function allowedValues(constraint: string): string[] {
  const match = new RegExp(`constraint ${constraint} check \\( ?\\w+ in \\(([^)]*)\\) ?\\)`).exec(sql);
  if (!match) throw new Error(`No CHECK found for ${constraint}`);
  return match[1].split(",").map((v) => v.trim().replace(/'/g, ""));
}

describe("admin_preferences matches lib/admin-preferences.ts", () => {
  it("has the same column defaults as DEFAULT_ADMIN_PREFERENCES", () => {
    expect({
      landingPage: columnDefault("landing_page"),
      calendarView: columnDefault("calendar_view"),
      weekStartsOn: columnDefault("week_starts_on"),
      calendarStartHour: Number(columnDefault("calendar_start_hour")),
      calendarEndHour: Number(columnDefault("calendar_end_hour")),
      unassignedListCollapsed: columnDefault("unassigned_list_collapsed") === "true",
      bookingsDefaultFilter: columnDefault("bookings_default_filter"),
    }).toEqual(DEFAULT_ADMIN_PREFERENCES);
  });

  it("allows exactly the values the Settings form offers", () => {
    expect(allowedValues("admin_preferences_landing_page_check")).toEqual(LANDING_PAGE_OPTIONS.map((o) => o.value));
    expect(allowedValues("admin_preferences_calendar_view_check")).toEqual(CALENDAR_VIEW_OPTIONS.map((o) => o.value));
    expect(allowedValues("admin_preferences_week_starts_on_check")).toEqual(WEEK_START_OPTIONS.map((o) => o.value));
    expect(allowedValues("admin_preferences_bookings_default_filter_check")).toEqual(
      BOOKINGS_FILTER_OPTIONS.map((o) => o.value),
    );
  });

  it("limits the visible hours the way validatePreferences does", () => {
    expect(sql).toContain(
      `constraint admin_preferences_start_hour_check check (calendar_start_hour between ${FIRST_HOUR_RANGE.min} and ${FIRST_HOUR_RANGE.max})`,
    );
    expect(sql).toContain(
      `constraint admin_preferences_end_hour_check check (calendar_end_hour between ${LAST_HOUR_RANGE.min} and ${LAST_HOUR_RANGE.max})`,
    );
    expect(sql).toContain(
      `check (calendar_end_hour - calendar_start_hour >= ${MIN_VISIBLE_HOURS})`,
    );
  });

  it("is admin-only and never lets a user change whose row it is", () => {
    // RLS on, every policy tied to the caller's own id and the admin claim.
    expect(sql).toContain("alter table admin_preferences enable row level security");
    const policies = sql.match(/create policy "[a-z_]+" on admin_preferences/g) ?? [];
    expect(policies).toHaveLength(3);
    // select (using), insert (with check) and update (using + with check) = 4 clauses.
    expect(sql.match(/user_id = \(select auth\.uid\(\)\)/g)).toHaveLength(4);
    expect(sql.match(/app_metadata' ->> 'role'\) = 'admin'/g)).toHaveLength(4);
    // Nothing for anon, no delete, and user_id is not in the update grant.
    expect(sql).toContain("revoke all on table admin_preferences from anon, authenticated");
    expect(sql).not.toMatch(/grant [^;]*delete[^;]*on table admin_preferences/);
    const updateGrant = /grant update \(([^)]*)\) on table admin_preferences/.exec(sql)![1];
    expect(updateGrant).not.toContain("user_id");
  });

  it("takes the user from the JWT in save_admin_preferences, never from an argument", () => {
    const params = /create function save_admin_preferences\(([^)]*)\)/.exec(sql)![1];
    expect(params).not.toMatch(/user/);
    expect(sql).toContain("v_user uuid := auth.uid()");
  });
});
