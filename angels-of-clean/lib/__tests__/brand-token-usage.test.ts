import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// B21: the brand teal lives in one place, the --primary / --primary-pressed
// tokens in app/globals.css. This fails if a hex or a Tailwind teal-* class
// comes back, so the greens can't drift apart again.
const ROOT = join(__dirname, "..", "..");
const SOURCE_DIRS = ["app", "components", "lib", "store"];
const GLOBALS = join("app", "globals.css");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(path);
    }
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

const files = SOURCE_DIRS.flatMap((d) => sourceFiles(join(ROOT, d))).filter(
  (f) => relative(ROOT, f) !== GLOBALS,
);

describe("brand teal comes from the --primary token", () => {
  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each([
    ["the brand hex #1a6b5a (any case): use bg-/text-/border-primary", /#1a6b5a/i],
    ["the pressed hex #124d41 or its old twin #155a4b: use primary-pressed", /#(?:124d41|155a4b)/i],
    ["a Tailwind teal-* class: use the primary token", /\bteal-\d/],
  ])("no file outside app/globals.css uses %s", (_name, pattern) => {
    const offenders = files
      .filter((f) => pattern.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });

  describe("app/globals.css", () => {
    const css = readFileSync(join(ROOT, GLOBALS), "utf8");

    it("maps --primary to #1A6B5A and --primary-pressed to #124D41", () => {
      expect(css).toMatch(/:root\s*{[^}]*--primary:\s*#1a6b5a\s*;/i);
      expect(css).toMatch(/:root\s*{[^}]*--primary-pressed:\s*#124d41\s*;/i);
    });

    it("exposes both to Tailwind (bg-primary, hover:bg-primary-pressed, …)", () => {
      expect(css).toMatch(/--color-primary:\s*var\(--primary\)\s*;/);
      expect(css).toMatch(/--color-primary-pressed:\s*var\(--primary-pressed\)\s*;/);
    });
  });
});
