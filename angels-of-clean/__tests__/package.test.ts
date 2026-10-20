import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const appRoot = path.resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(path.join(appRoot, "package.json"), "utf8"));

const versionParts = (version: string) => version.split(".").map(Number);

describe("package.json", () => {
  // 16.4.2 is npm audit's fix for the advisories against 16.2.10, including a
  // proxy (middleware) bypass.
  it("keeps Next.js 16 at or above 16.4.2", () => {
    const [major, minor, patch] = versionParts(pkg.dependencies.next);
    expect(major).toBe(16);
    expect(minor * 1000 + patch).toBeGreaterThanOrEqual(4 * 1000 + 2);
  });

  it("upgrades eslint-config-next together with next", () => {
    expect(pkg.devDependencies["eslint-config-next"]).toBe(pkg.dependencies.next);
  });

  // The shadcn CLI pulls express and the MCP SDK into production installs.
  // app/globals.css only needs its stylesheet at build time.
  it("installs the shadcn CLI for development only", () => {
    expect(pkg.dependencies.shadcn).toBeUndefined();
    expect(pkg.devDependencies.shadcn).toBeDefined();
  });

  it("pins Node 22, matching CI, in engines and .nvmrc", () => {
    expect(pkg.engines.node).toBe(">=22");
    expect(readFileSync(path.join(appRoot, ".nvmrc"), "utf8").trim()).toBe("22");
  });
});
