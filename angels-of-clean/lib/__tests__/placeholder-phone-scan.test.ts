import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function scanFilesForText(
  dir: string,
  pattern: string,
  excludePatterns: string[]
): string[] {
  const matches: string[] = [];

  function scan(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      // Skip node_modules and hidden directories
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name.startsWith(".")
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile()) {
        // Only check TypeScript files
        if (!/(\.ts|\.tsx)$/.test(entry.name)) continue;

        // Skip test files
        if (excludePatterns.some((p) => fullPath.includes(p))) continue;

        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes(pattern)) {
            matches.push(fullPath);
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  scan(dir);
  return matches;
}

describe("Placeholder phone number scan", () => {
  const projectRoot = path.join(__dirname, "../..");

  it("should not contain 555-CLEAN outside of test files", () => {
    const matches = scanFilesForText(projectRoot, "555-CLEAN", [
      "__tests__",
      ".test.ts",
      ".test.tsx",
    ]);
    if (matches.length > 0) {
      expect.fail(`Found 555-CLEAN in:\n${matches.join("\n")}`);
    }
    expect(matches).toEqual([]);
  });

  it("should not contain 555-0100 outside of test files", () => {
    const matches = scanFilesForText(projectRoot, "555-0100", [
      "__tests__",
      ".test.ts",
      ".test.tsx",
    ]);
    if (matches.length > 0) {
      expect.fail(`Found 555-0100 in:\n${matches.join("\n")}`);
    }
    expect(matches).toEqual([]);
  });
});
