// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  generateInviteToken,
  hashInviteToken,
  INVITE_TOKEN_PATTERN,
  parseInviteToken,
} from "../customer-invite";

describe("invite tokens", () => {
  it("makes a 43-character URL-safe token that is different every time", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).toMatch(INVITE_TOKEN_PATTERN);
    expect(a).toHaveLength(43);
    expect(a).not.toBe(b);
  });

  it("accepts only the shape it issues", () => {
    const token = generateInviteToken();
    expect(parseInviteToken(token)).toBe(token);
    for (const bad of [undefined, null, 42, "", "short", `${token}x`, `${token.slice(1)}!`, ["a"]]) {
      expect(parseInviteToken(bad)).toBeNull();
    }
  });

  it("hashes to the 64 hex characters the database stores, and never to the token", () => {
    const token = generateInviteToken();
    const hash = hashInviteToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashInviteToken(token));
    expect(hash).not.toContain(token);
  });

  it("matches the known SHA-256 of a fixed input (what the SQL side compares against)", () => {
    expect(hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
