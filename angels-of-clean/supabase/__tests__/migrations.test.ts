// @vitest-environment node
import { readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

// The Supabase CLI only applies supabase/migrations/<14-digit version>_<name>.sql,
// in version order, and records each version in the remote history table.
const SUPABASE_DIR = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(SUPABASE_DIR, "migrations");
const MIGRATION_FILE = /^(\d{14})_[a-z0-9_]+\.sql$/;

// Already applied to production. Renaming or removing one of these breaks the
// remote migration history; add a new migration instead.
const APPLIED = [
  "20260726221400_initial_schema.sql",
  "20260918194509_admin_role_rls.sql",
  "20261013224928_rate_limits.sql",
  "20261013230608_commercial_quotes.sql",
  "20261018142718_assign_booking_employees.sql",
];

const migrations = readdirSync(MIGRATIONS_DIR).sort();

describe("supabase migrations", () => {
  it("names every migration <version>_<snake_case_name>.sql", () => {
    expect(migrations.filter((f) => !MIGRATION_FILE.test(f))).toEqual([]);
  });

  it("gives every migration a unique version", () => {
    const versions = migrations.map((f) => f.slice(0, 14));
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("keeps the applied migrations, unrenamed and first", () => {
    expect(migrations.slice(0, APPLIED.length)).toEqual(APPLIED);
  });

  it("has no loose .sql files the CLI would ignore", () => {
    // Hand-numbered files in supabase/ are never applied. Schema changes go in
    // migrations/ (npx supabase migration new <name>); one-off fixes in scripts/.
    // seed.sql is the local-only seed file config.toml points at.
    const loose = readdirSync(SUPABASE_DIR).filter(
      (f) => f.endsWith(".sql") && f !== "seed.sql",
    );
    expect(loose).toEqual([]);
  });
});
