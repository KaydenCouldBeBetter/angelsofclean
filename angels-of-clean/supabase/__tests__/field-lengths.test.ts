// @vitest-environment node
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { FIELD_MAX_LENGTHS } from "@/lib/constants";

// The database repeats the app's length caps as CHECK constraints named
// <table>_<column>_length (char_length(<column>) <= <n>). These are the
// columns each FIELD_MAX_LENGTHS key is stored in.
const COLUMN_LIMITS: Record<string, Record<string, keyof typeof FIELD_MAX_LENGTHS>> = {
  bookings: {
    client_name: "name",
    email: "email",
    phone: "phone",
    address: "address",
    city: "city",
    notes: "notes",
  },
  booking_access: {
    instructions: "accessInstructions",
  },
  commercial_quotes: {
    business_name: "businessName",
    contact_name: "name",
    email: "email",
    phone: "phone",
    address: "address",
    city: "city",
    notes: "notes",
  },
};

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

// Replays every migration in order, so a later migration that drops or
// redefines a constraint wins. Comments are stripped first.
function lengthConstraints(): Map<string, { column: string; max: number }> {
  const constraints = new Map<string, { column: string; max: number }>();
  const statement =
    /drop\s+constraint\s+(?:if\s+exists\s+)?(\w+)|constraint\s+(\w+)\s+check\s*\(\s*char_length\(\s*(\w+)\s*\)\s*<=\s*(\d+)\s*\)/gi;

  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/--.*$/gm, "");
    for (const [, dropped, name, column, max] of sql.matchAll(statement)) {
      if (dropped) constraints.delete(dropped.toLowerCase());
      else constraints.set(name.toLowerCase(), { column: column.toLowerCase(), max: Number(max) });
    }
  }
  return constraints;
}

const constraints = lengthConstraints();
const expected = Object.entries(COLUMN_LIMITS).flatMap(([table, columns]) =>
  Object.entries(columns).map(([column, field]) => ({ table, column, field })),
);

describe("database length limits", () => {
  it.each(expected)(
    "caps $column in $table at FIELD_MAX_LENGTHS[$field]",
    ({ table, column, field }) => {
      expect(constraints.get(`${table}_${column}_length`)).toEqual({
        column,
        max: FIELD_MAX_LENGTHS[field],
      });
    },
  );

  it("has no length constraint missing from COLUMN_LIMITS", () => {
    const known = new Set(expected.map(({ table, column }) => `${table}_${column}_length`));
    expect([...constraints.keys()].filter((name) => !known.has(name))).toEqual([]);
  });

  it("stores every FIELD_MAX_LENGTHS field in a capped column", () => {
    const covered = new Set<string>(expected.map(({ field }) => field));
    expect(Object.keys(FIELD_MAX_LENGTHS).filter((field) => !covered.has(field))).toEqual([]);
  });
});
