import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeCustomerSignIn, parseInviteNotice } from "../customer-session";
import { hashInviteToken } from "@/lib/customer-invite";

type RpcResult = { data: unknown; error: { code?: string } | null };
const rpc = vi.fn<(fn: string, args?: Record<string, unknown>) => Promise<RpcResult>>();
const updateUser = vi.fn(() => Promise.resolve({ error: null }));
const supabase = { rpc, auth: { updateUser } } as unknown as Parameters<
  typeof completeCustomerSignIn
>[0];

const TOKEN = "A".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  rpc.mockImplementation((fn) =>
    Promise.resolve({
      data: fn === "accept_account_invite" ? { status: "joined" } : { status: "ok" },
      error: null,
    }),
  );
});

describe("completeCustomerSignIn", () => {
  it("claims records and goes to the account page", async () => {
    expect(await completeCustomerSignIn(supabase, null)).toEqual({ destination: "/account" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("claim_account_records");
  });

  it("accepts the invite first, sending only the hash, then claims", async () => {
    await completeCustomerSignIn(supabase, TOKEN);
    expect(rpc.mock.calls.map(([fn]) => fn)).toEqual([
      "accept_account_invite",
      "claim_account_records",
    ]);
    expect(rpc).toHaveBeenNthCalledWith(1, "accept_account_invite", {
      p_token_hash: hashInviteToken(TOKEN),
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(TOKEN);
  });

  it("clears the stored token once the invite worked", async () => {
    await completeCustomerSignIn(supabase, TOKEN);
    expect(updateUser).toHaveBeenCalledWith({ data: { invite_token: null } });
  });

  it("treats someone who is already on the account as done", async () => {
    rpc.mockImplementation((fn) =>
      Promise.resolve({
        data: fn === "accept_account_invite" ? { status: "already_member" } : { status: "ok" },
        error: null,
      }),
    );
    expect(await completeCustomerSignIn(supabase, TOKEN)).toEqual({ destination: "/account" });
  });

  it.each(["invalid", "wrong_email", "unverified", "already_in_account"])(
    "says so on the account page when the invite result is %s",
    async (status) => {
      rpc.mockImplementation((fn) =>
        Promise.resolve({
          data: fn === "accept_account_invite" ? { status } : { status: "ok" },
          error: null,
        }),
      );
      expect(await completeCustomerSignIn(supabase, TOKEN)).toEqual({
        destination: `/account?invite=${status}`,
      });
      expect(updateUser).not.toHaveBeenCalled();
      // The customer still gets their own records either way.
      expect(rpc).toHaveBeenCalledWith("claim_account_records");
    },
  );

  it("reports a failed invite call as an error, logging only a code", async () => {
    rpc.mockImplementation((fn) =>
      Promise.resolve(
        fn === "accept_account_invite"
          ? { data: null, error: { code: "PGRST301" } }
          : { data: { status: "ok" }, error: null },
      ),
    );
    expect(await completeCustomerSignIn(supabase, TOKEN)).toEqual({
      destination: "/account?invite=error",
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(TOKEN);
  });

  it("still lets the customer in when claiming fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await completeCustomerSignIn(supabase, null)).toEqual({ destination: "/account" });
  });

  it("only ever returns a path on this site", async () => {
    const { destination } = await completeCustomerSignIn(supabase, TOKEN);
    expect(destination.startsWith("/")).toBe(true);
    expect(destination.startsWith("//")).toBe(false);
  });
});

describe("parseInviteNotice", () => {
  it("knows only the statuses the account page words", () => {
    expect(parseInviteNotice("wrong_email")).toBe("wrong_email");
    for (const bad of [undefined, "joined", "<script>", "", 1]) {
      expect(parseInviteNotice(bad)).toBeNull();
    }
  });
});
