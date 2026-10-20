import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// B47: every displayed time goes through lib/datetime.ts. This fails if a
// component brings back its own formatter, so the formats can't drift apart.
const ROOT = join(__dirname, "..", "..");
const SOURCE_DIRS = ["app", "components", "lib", "store"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = SOURCE_DIRS.flatMap((d) => sourceFiles(join(ROOT, d))).filter(
  (f) => relative(ROOT, f) !== join("lib", "datetime.ts"),
);

describe("time formatting goes through lib/datetime.ts", () => {
  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each([
    ["an Intl hour option", /hour\s*:\s*["'](?:2-digit|numeric)["']/],
    ["toLocaleTimeString", /toLocaleTimeString/],
    ["a local formatTime helper", /function\s+formatTime\b/],
    ["a minute-less time like 8am or 12pm", /(?<![:\d])\d{1,2}(?:am|pm)\b/i],
  ])("no file outside lib/datetime.ts uses %s", (_name, pattern) => {
    const offenders = files
      .filter((f) => pattern.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});

// Wave 10C: dates too. A date label built with the browser's own zone (or a
// zone-less `new Date("…T12:00:00")`) can show the wrong day, so every date the
// customer sees goes through formatNy / lib/booking-date.ts.
describe("date formatting goes through lib/datetime.ts", () => {
  it.each([
    ["toLocaleDateString", /toLocaleDateString/],
    ["toLocaleString", /toLocaleString/],
    // `${date}T12:00:00` is read in the browser's zone; `…T12:00:00Z` is not.
    ["a zone-less new Date(`…T12:00:00`)", /T12:00:00(?!Z)/],
  ])("no file outside lib/datetime.ts uses %s", (_name, pattern) => {
    const offenders = files
      .filter((f) => pattern.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
