import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// B25: one focus ring for every interactive element, defined once in
// app/globals.css as a :focus-visible rule. Components must not hand-roll their
// own (or switch the outline off), or the ring would differ from place to place.
const ROOT = join(__dirname, "..", "..");
const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");

// The body of `selector { … }`, plus how many blocks deep it sits (0 = top level).
function rule(selector: string) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return null;
  const open = css.indexOf("{", start);
  const body = css.slice(open + 1, css.indexOf("}", open));
  const before = css.slice(0, start);
  const depth = (before.match(/{/g) ?? []).length - (before.match(/}/g) ?? []).length;
  return { body, depth };
}

describe("focus ring (globals.css)", () => {
  it("has a :focus-visible rule: 2px solid #124D41 (the pressed token), 2px offset", () => {
    const r = rule(":focus-visible");
    expect(r).not.toBeNull();
    expect(r!.body).toMatch(/outline:\s*2px solid var\(--primary-pressed\)/);
    expect(r!.body).toMatch(/outline-offset:\s*2px/);
    expect(css).toMatch(/--primary-pressed:\s*#124d41/i);
  });

  it("sits outside any @layer, so it beats utilities like outline-none", () => {
    expect(rule(":focus-visible")!.depth).toBe(0);
  });

  it("is restated inside the FullCalendar scope, which sets its own outline", () => {
    const r = rule(".admin-calendar :focus-visible");
    expect(r).not.toBeNull();
    expect(r!.body).toMatch(/outline:\s*2px solid var\(--primary-pressed\)\s*!important/);
    expect(r!.body).toMatch(/outline-offset:\s*2px\s*!important/);
    // The old rule that switched the toolbar buttons' focus off must stay gone.
    expect(css).not.toMatch(/\.fc-button:focus\s*{/);
  });

  it("gives the ring to the label of a visually hidden checkbox or radio", () => {
    expect(css).toMatch(/label:has\(input\.sr-only:focus-visible\)/);
  });

  it("switches to white on dark chrome, where #124D41 can't be seen", () => {
    expect(rule('[data-focus-surface="dark"] :focus-visible')!.body).toMatch(/outline-color:\s*#ffffff/i);
    const shell = readFileSync(join(ROOT, "app", "admin", "AdminShell.tsx"), "utf8");
    expect(shell).toMatch(/<aside data-focus-surface="dark"/);
  });
});

describe("focus not obscured by the sticky bottom CTA (WCAG 2.4.11)", () => {
  it("reserves at least the CTA's height as scroll padding while one is on the page", () => {
    const r = rule("html:has([data-bottom-cta])");
    expect(r).not.toBeNull();
    const rem = Number(r!.body.match(/scroll-padding-bottom:\s*([\d.]+)rem/)?.[1]);
    // p-4 + h-14 + p-4 + the 1px border = 89px; the ring reaches 4px past a button.
    expect(rem * 16).toBeGreaterThanOrEqual(89 + 4);
  });

  it("BottomCTA carries the marker the rule looks for", () => {
    const src = readFileSync(join(ROOT, "components", "booking", "BottomCTA.tsx"), "utf8");
    expect(src).toMatch(/<div data-bottom-cta\b/);
    expect(src).toMatch(/\bfixed bottom-0\b/);
  });
});

describe("components don't hand-roll focus styles", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(path);
      }
      return /\.tsx$/.test(name) ? [path] : [];
    });
  }
  const files = ["app", "components"].flatMap((d) => sourceFiles(join(ROOT, d)));

  it.each([
    ["outline-none (it would hide the ring)", /(?<![\w-])(?:focus(?:-visible)?:)?outline-none\b/],
    ["a focus:ring-* / focus-visible:ring-* class", /(?:focus|focus-visible|peer-focus-visible):ring-/],
    ["a focus:outline-* / focus-visible:outline-* class", /(?:focus|focus-visible):outline-/],
    ["a focus:border-* class", /focus:border-/],
  ])("no component uses %s", (_name, pattern) => {
    const offenders = files
      .filter((f) => pattern.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
