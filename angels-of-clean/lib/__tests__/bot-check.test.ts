import { describe, it, expect } from "vitest";
import { looksLikeBot, MIN_FILL_MS } from "@/lib/bot-check";

describe("looksLikeBot", () => {
  it("passes an empty honeypot with a long fill time", () => {
    expect(looksLikeBot({ website: "", elapsedMs: 60_000 })).toBe(false);
  });

  it("passes exactly the minimum fill time and fails one millisecond under it", () => {
    expect(looksLikeBot({ website: "", elapsedMs: MIN_FILL_MS })).toBe(false);
    expect(looksLikeBot({ website: "", elapsedMs: MIN_FILL_MS - 1 })).toBe(true);
  });

  it("is about three seconds", () => {
    expect(MIN_FILL_MS).toBe(3000);
  });

  it("fails any filled honeypot, even a single space", () => {
    expect(looksLikeBot({ website: "http://spam.example", elapsedMs: 60_000 })).toBe(true);
    expect(looksLikeBot({ website: " ", elapsedMs: 60_000 })).toBe(true);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "human"],
    ["an empty object", {}],
    ["a missing fill time", { website: "" }],
    ["a missing honeypot", { elapsedMs: 60_000 }],
    ["a string fill time", { website: "", elapsedMs: "60000" }],
    ["NaN", { website: "", elapsedMs: NaN }],
    ["Infinity", { website: "", elapsedMs: Infinity }],
    ["a negative fill time", { website: "", elapsedMs: -5000 }],
    ["a non-string honeypot", { website: 0, elapsedMs: 60_000 }],
  ])("fails %s", (_case, value) => {
    expect(looksLikeBot(value)).toBe(true);
  });
});
