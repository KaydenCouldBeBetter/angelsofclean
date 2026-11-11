// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { code?: string } | null };
interface Recorded {
  table: string;
  columns?: string;
  eq: [string, unknown][];
  is: [string, unknown][];
}
const recorded: Recorded[] = [];
let byTable: Record<string, Result> = {};

function builderFor(entry: Recorded) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const b: any = {};
  b.select = (c: string) => ((entry.columns = c), b);
  b.eq = (c: string, v: unknown) => (entry.eq.push([c, v]), b);
  b.is = (c: string, v: unknown) => (entry.is.push([c, v]), b);
  b.order = () => b;
  b.then = (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(byTable[entry.table] ?? { data: [], error: null }).then(resolve, reject);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return b;
}

vi.mock("../server", () => ({
  createClient: () =>
    Promise.resolve({
      from: (table: string) => {
        const entry: Recorded = { table, eq: [], is: [] };
        recorded.push(entry);
        return builderFor(entry);
      },
    }),
}));

import { getCustomerQuotes, getTeam } from "../customer-queries";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  recorded.length = 0;
  byTable = {};
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
});

describe("getCustomerQuotes", () => {
  it("labels each request, filtered to the account, with no contact details selected", async () => {
    byTable.commercial_quotes = {
      error: null,
      data: [
        {
          id: "q1",
          quote_number: 1007,
          facility_type: "office",
          sqft_range: "2k-5k",
          frequency: "2-3x",
          address: "10 Salina St",
          city: "Syracuse",
          zip: "13202",
          submitted_at: "2026-11-02T14:00:00Z",
        },
      ],
    };
    const result = await getCustomerQuotes(ACCOUNT);
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: "q1",
          ref: "COM-1007",
          submittedLabel: "November 2, 2026",
          facilityLabel: "Office",
          sqftLabel: "2,000 – 5,000 sq ft",
          frequencyLabel: "2–3x / week",
          address: "10 Salina St",
          cityLine: "Syracuse, 13202",
        },
      ],
    });
    expect(recorded[0].eq).toEqual([["account_id", ACCOUNT]]);
    expect(recorded[0].columns).not.toMatch(/email|phone|contact_name|notes/);
  });

  it("is not ok when the query fails, and logs only a code", async () => {
    byTable.commercial_quotes = { data: null, error: { code: "57P03" } };
    expect(await getCustomerQuotes(ACCOUNT)).toEqual({ ok: false });
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)).toContain("57P03");
  });
});

describe("getTeam", () => {
  it("returns members and unused invites for the account, never asking for token_hash", async () => {
    byTable.account_members = {
      error: null,
      data: [{ user_id: "u1", email: "bob@biz.com", role: "owner", created_at: "2026-11-01T12:00:00Z" }],
    };
    byTable.account_invites = {
      error: null,
      data: [
        { id: "i1", email: "dave@biz.com", expires_at: "2026-11-12T12:00:00Z" },
        { id: "i2", email: "old@biz.com", expires_at: "2026-11-02T12:00:00Z" },
      ],
    };
    const result = await getTeam(ACCOUNT);
    expect(result).toEqual({
      ok: true,
      data: {
        members: [{ userId: "u1", email: "bob@biz.com", role: "owner", joinedLabel: "November 1, 2026" }],
        invites: [
          { id: "i1", email: "dave@biz.com", expiresLabel: "November 12, 2026", expired: false },
          { id: "i2", email: "old@biz.com", expiresLabel: "November 2, 2026", expired: true },
        ],
      },
    });
    const invites = recorded.find((r) => r.table === "account_invites")!;
    expect(invites.columns).not.toContain("token_hash");
    expect(invites.columns).not.toContain("*");
    expect(invites.eq).toEqual([["account_id", ACCOUNT]]);
    expect(invites.is).toEqual([["accepted_at", null]]);
    expect(recorded.find((r) => r.table === "account_members")!.eq).toEqual([["account_id", ACCOUNT]]);
  });

  it("is not ok if either query fails", async () => {
    byTable.account_members = { data: [], error: null };
    byTable.account_invites = { data: null, error: { code: "42501" } };
    expect(await getTeam(ACCOUNT)).toEqual({ ok: false });
    byTable.account_members = { data: null, error: { code: "42501" } };
    byTable.account_invites = { data: [], error: null };
    expect(await getTeam(ACCOUNT)).toEqual({ ok: false });
  });
});
