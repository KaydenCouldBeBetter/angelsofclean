// @vitest-environment node
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { BOOKING_MAX_DAYS_AHEAD, FIELD_MAX_LENGTHS } from "@/lib/constants";
import {
  BLACKOUT_MAX_DAYS_OUT,
  DEFAULT_BOOKING_RULES,
  MAX_DAYS_AHEAD_OPTIONS,
  MIN_NOTICE_MAX_HOURS,
  MIN_NOTICE_OPTIONS,
} from "@/lib/booking-rules";

// The booking controls repeat the app's limits and defaults in SQL. This reads
// the migration and fails if either side changes without the other.
const MIGRATION = path.resolve(__dirname, "..", "migrations", "20261113205039_booking_controls.sql");
const sql = readFileSync(MIGRATION, "utf8")
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ");

function columnDefault(column: string): string {
  const match = new RegExp(`${column} (?:text|smallint|boolean) not null default ('[^']*'|\\d+|true|false)`).exec(sql);
  if (!match) throw new Error(`No default found for ${column}`);
  return match[1].replace(/'/g, "");
}

describe("booking controls match lib/booking-rules.ts", () => {
  it("has the same defaults as DEFAULT_BOOKING_RULES", () => {
    expect({
      paused: columnDefault("online_booking_paused") === "true",
      pauseMessage: columnDefault("pause_message"),
      minNoticeHours: Number(columnDefault("min_notice_hours")),
      maxDaysAhead: Number(columnDefault("max_days_ahead")),
    }).toEqual({
      paused: DEFAULT_BOOKING_RULES.paused,
      pauseMessage: DEFAULT_BOOKING_RULES.pauseMessage,
      minNoticeHours: DEFAULT_BOOKING_RULES.minNoticeHours,
      maxDaysAhead: DEFAULT_BOOKING_RULES.maxDaysAhead,
    });
  });

  it("limits notice and the day window to what the Settings selects can offer", () => {
    expect(sql).toContain(`check (min_notice_hours between 0 and ${MIN_NOTICE_MAX_HOURS})`);
    expect(sql).toContain(`check (max_days_ahead between 1 and ${BOOKING_MAX_DAYS_AHEAD})`);
    expect(Math.max(...MIN_NOTICE_OPTIONS)).toBeLessThanOrEqual(MIN_NOTICE_MAX_HOURS);
    expect(Math.max(...MAX_DAYS_AHEAD_OPTIONS)).toBeLessThanOrEqual(BOOKING_MAX_DAYS_AHEAD);
  });

  it("allows a blackout date as far out as the app does", () => {
    expect(sql).toContain(`p_day > v_today + ${BLACKOUT_MAX_DAYS_OUT}`);
  });

  it("keeps the two length limits in FIELD_MAX_LENGTHS (field-lengths.test.ts checks the CHECKs)", () => {
    expect(FIELD_MAX_LENGTHS.pauseMessage).toBe(200);
    expect(FIELD_MAX_LENGTHS.blackoutLabel).toBe(100);
  });

  it("holds exactly one settings row", () => {
    expect(sql).toContain("constraint booking_settings_single_row_check check (id)");
    expect(sql).toContain("id boolean primary key default true");
    expect(sql).toContain("insert into booking_settings default values");
  });
});

describe("who may touch these tables", () => {
  it("gives admins read-only access, and nobody any write privilege", () => {
    expect(sql).toContain("revoke all on table booking_settings, blackout_dates, settings_audit from anon, authenticated");
    expect(sql).toContain("grant select on table booking_settings, blackout_dates, settings_audit to authenticated");
    expect(sql).not.toMatch(/grant [^;]*(insert|update|delete)[^;]* on table (booking_settings|blackout_dates|settings_audit)/);
    for (const table of ["booking_settings", "blackout_dates", "settings_audit"]) {
      expect(sql).toContain(`alter table ${table} enable row level security`);
    }
    const policies = sql.match(/create policy "[a-z_]+" on (booking_settings|blackout_dates|settings_audit) for select using \(\(auth\.jwt\(\) -> 'app_metadata' ->> 'role'\) = 'admin'\)/g);
    expect(policies).toHaveLength(3);
    expect(sql.match(/create policy/g)).toHaveLength(3); // no write policy anywhere
  });

  it("lets anon call get_booking_rules and nothing else", () => {
    expect(sql).toContain("grant execute on function get_booking_rules() to anon, authenticated, service_role");
    for (const fn of [
      "save_booking_settings(boolean, text, smallint, smallint)",
      "add_blackout_date(date, text)",
      "remove_blackout_date(date)",
    ]) {
      expect(sql).toContain(`revoke execute on function ${fn} from public, anon`);
      expect(sql).toContain(`grant execute on function ${fn} to authenticated`);
    }
  });

  it("checks the admin claim in every writing function", () => {
    for (const fn of ["save_booking_settings", "add_blackout_date", "remove_blackout_date"]) {
      const body = new RegExp(`create function ${fn}\\(.*?\\$\\$;`).exec(sql)![0];
      expect(body, fn).toContain("security definer");
      expect(body, fn).toContain("coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin'");
      expect(body, fn).toContain("insert into settings_audit");
    }
  });

  it("exposes only the five public values, and no labels", () => {
    const body = /create function get_booking_rules\(\).*?as \$\$(.*?)\$\$/.exec(sql)![1];
    for (const key of ["paused", "pause_message", "min_notice_hours", "max_days_ahead", "blackout_dates"]) {
      expect(body).toContain(`'${key}'`);
    }
    expect(body).not.toMatch(/label|created_by|updated_by|audit/);
  });
});
