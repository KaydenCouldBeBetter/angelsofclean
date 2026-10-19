// @vitest-environment node
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import type { JobStatus } from "@/lib/admin-types";
import { STATUS_ACTIVITY_LABEL, STATUS_TRANSITIONS, canChangeStatus } from "../status-config";

const STATUSES: JobStatus[] = ["pending", "confirmed", "active", "done", "cancelled"];

// The flow B12 asks for, spelled out pair by pair.
const ALLOWED = new Set([
  "pending→confirmed",
  "confirmed→active",
  "active→done",
  "pending→cancelled",
  "confirmed→cancelled",
  "active→cancelled",
]);

const ALL_PAIRS = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to] as const));

describe("booking status flow", () => {
  it.each(ALL_PAIRS.filter(([from, to]) => ALLOWED.has(`${from}→${to}`)))(
    "allows %s → %s",
    (from, to) => {
      expect(canChangeStatus(from, to)).toBe(true);
    },
  );

  it.each(ALL_PAIRS.filter(([from, to]) => !ALLOWED.has(`${from}→${to}`)))(
    "refuses %s → %s",
    (from, to) => {
      expect(canChangeStatus(from, to)).toBe(false);
    },
  );

  it("never reopens a done or cancelled booking", () => {
    expect(STATUS_TRANSITIONS.done).toEqual([]);
    expect(STATUS_TRANSITIONS.cancelled).toEqual([]);
  });

  it("has an activity label for every status a booking can move to", () => {
    const targets = new Set(Object.values(STATUS_TRANSITIONS).flat());
    expect(new Set(Object.keys(STATUS_ACTIVITY_LABEL))).toEqual(targets);
  });

  it("matches the list Postgres enforces", () => {
    const sql = readFileSync(
      path.resolve(__dirname, "../../../supabase/migrations/20261019032629_booking_status_flow.sql"),
      "utf8",
    );
    const body = sql.match(
      /create function booking_status_transition_allowed[\s\S]*?\$\$([\s\S]*?)\$\$;/,
    )?.[1];
    expect(body).toBeDefined();
    const inSql = [...body!.matchAll(/\(\s*'(\w+)',\s*'(\w+)'\s*\)/g)].map(
      ([, from, to]) => `${from}→${to}`,
    );
    const inTs = Object.entries(STATUS_TRANSITIONS).flatMap(([from, tos]) =>
      tos.map((to) => `${from}→${to}`),
    );
    expect(new Set(inSql)).toEqual(new Set(inTs));
    expect(inSql).toHaveLength(inTs.length);
  });
});
