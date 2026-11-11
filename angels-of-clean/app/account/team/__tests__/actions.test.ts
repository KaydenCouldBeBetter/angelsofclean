import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCustomerMock = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/require-customer", () => ({ requireCustomer: () => requireCustomerMock() }));

import { createTeamInvite, removeTeamMember, revokeTeamInvite } from "../actions";
import { hashInviteToken, INVITE_TOKEN_PATTERN } from "@/lib/customer-invite";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  requireCustomerMock.mockResolvedValue({ ok: true, supabase: { rpc }, user: { id: "u" } });
  rpc.mockResolvedValue({ data: { status: "created" }, error: null });
});

describe("every team action needs a signed-in customer", () => {
  const SIGNED_OUT = { ok: false, error: "You must be signed in to do this." };
  const attempts: [string, () => Promise<unknown>][] = [
    ["createTeamInvite", () => createTeamInvite("a@b.com")],
    ["revokeTeamInvite", () => revokeTeamInvite(ID)],
    ["removeTeamMember", () => removeTeamMember(ID)],
  ];
  it.each(attempts)("%s refuses a signed-out visitor without calling the database", async (_n, attempt) => {
    requireCustomerMock.mockResolvedValue(SIGNED_OUT);
    expect(await attempt()).toEqual({ success: false, error: SIGNED_OUT.error });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("createTeamInvite", () => {
  it("sends only the token's hash to the database and returns the token once", async () => {
    const result = await createTeamInvite("  Carol@Biz.com ");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.token).toMatch(INVITE_TOKEN_PATTERN);
    expect(rpc).toHaveBeenCalledWith("create_account_invite", {
      p_token_hash: hashInviteToken(result.token),
      p_email: "Carol@Biz.com",
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(result.token);
  });

  it("refuses a bad email before calling the database", async () => {
    for (const bad of ["", "nope", "a@b", "x".repeat(260) + "@b.com", 5 as unknown as string]) {
      expect(await createTeamInvite(bad)).toEqual({ success: false, error: "Enter a valid email address." });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["not_owner", "Only the account owner can invite people."],
    ["not_commercial", "Only business accounts can invite people."],
    ["already_member", "That person is already on your team."],
    ["too_many", "You have too many pending invites. Cancel one first."],
    ["surprise", "Something went wrong. Please try again."],
  ])("explains %s", async (status, message) => {
    rpc.mockResolvedValue({ data: { status }, error: null });
    expect(await createTeamInvite("a@b.com")).toEqual({ success: false, error: message });
  });

  it("logs only a code when the database errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "secret@x.com" } });
    expect(await createTeamInvite("secret@x.com")).toEqual({
      success: false,
      error: "Something went wrong. Please try again.",
    });
    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).toContain("42501");
    expect(logged).not.toContain("secret@x.com");
  });
});

describe("revokeTeamInvite and removeTeamMember", () => {
  it("revoke calls its function with the id", async () => {
    rpc.mockResolvedValue({ data: { status: "revoked" }, error: null });
    expect(await revokeTeamInvite(ID)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("revoke_account_invite", { p_invite_id: ID });
  });

  it("remove calls its function with the user id", async () => {
    rpc.mockResolvedValue({ data: { status: "removed" }, error: null });
    expect(await removeTeamMember(ID)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("remove_account_member", { p_user_id: ID });
  });

  it("report a stale page when nothing matched", async () => {
    rpc.mockResolvedValue({ data: { status: "not_found" }, error: null });
    expect(await revokeTeamInvite(ID)).toMatchObject({ success: false });
    expect(await removeTeamMember(ID)).toMatchObject({ success: false });
  });

  it("refuse a malformed id without calling the database", async () => {
    expect(await revokeTeamInvite("nope")).toMatchObject({ success: false });
    expect(await removeTeamMember("nope")).toMatchObject({ success: false });
    expect(rpc).not.toHaveBeenCalled();
  });
});
