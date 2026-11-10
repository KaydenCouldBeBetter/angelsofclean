// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { code?: string } | null };
interface Recorded {
  table: string;
  columns?: string;
  eq: [string, unknown][];
  limit?: number;
}
const recorded: Recorded[] = [];
let byTable: Record<string, Result> = {};

function builderFor(entry: Recorded) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const b: any = {};
  const result = (): Result => {
    const r = byTable[entry.table] ?? { data: [], error: null };
    return r;
  };
  b.select = (c: string) => ((entry.columns = c), b);
  b.eq = (c: string, v: unknown) => (entry.eq.push([c, v]), b);
  b.order = () => b;
  b.limit = (n: number) => ((entry.limit = n), b);
  b.maybeSingle = () => {
    const r = result();
    return Promise.resolve({ ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data });
  };
  b.then = (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(resolve, reject);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return b;
}

vi.mock("../server", () => ({
  createClient: () =>
    Promise.resolve({
      from: (table: string) => {
        const entry: Recorded = { table, eq: [] };
        recorded.push(entry);
        return builderFor(entry);
      },
    }),
}));

import { getAdminAccountDetail, getAdminAccounts } from "../admin-customer-queries";

const ID = "11111111-1111-4111-8111-111111111111";
const DB_DOWN: Result = { data: null, error: { code: "57P03" } };

beforeEach(() => {
  vi.clearAllMocks();
  recorded.length = 0;
  byTable = {};
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getAdminAccounts", () => {
  it("summarises each account: owner, people, visits, plans, and what is owed", async () => {
    byTable.accounts = {
      error: null,
      data: [
        {
          id: ID,
          name: "Bob's Bakery",
          account_type: "commercial",
          created_at: "2026-11-01T12:00:00Z",
          account_members: [
            { email: "carol@biz.com", role: "member" },
            { email: "bob@biz.com", role: "owner" },
          ],
          service_plans: [{ status: "active" }, { status: "paused" }, { status: "ended" }],
          invoices: [
            { status: "open", amount_cents: 12500 },
            { status: "open", amount_cents: 7550 },
            { status: "paid", amount_cents: 99999 },
            { status: "void", amount_cents: 5000 },
          ],
          bookings: [{ count: 7 }],
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Alice",
          account_type: "residential",
          created_at: "2026-10-01T12:00:00Z",
          account_members: [],
          service_plans: [],
          invoices: [],
          bookings: [],
        },
      ],
    };
    const result = await getAdminAccounts();
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: ID,
          name: "Bob's Bakery",
          type: "commercial",
          ownerEmail: "bob@biz.com",
          memberCount: 2,
          visitCount: 7,
          planCount: 2,
          openInvoiceCount: 2,
          openBalanceCents: 20050,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Alice",
          type: "residential",
          ownerEmail: null,
          memberCount: 0,
          visitCount: 0,
          planCount: 0,
          openInvoiceCount: 0,
          openBalanceCents: 0,
        },
      ],
    });
  });

  it("asks for no customer contact beyond emails: no phone or notes, and not entry instructions", async () => {
    await getAdminAccounts();
    expect(recorded[0].table).toBe("accounts");
    expect(recorded[0].columns).not.toMatch(/phone|notes|access|instructions/);
  });

  it("fails, logging only a code, rather than listing no accounts", async () => {
    byTable.accounts = DB_DOWN;
    expect(await getAdminAccounts()).toEqual({ ok: false });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).toContain("57P03");
  });

  it("returns an empty list only when there genuinely are no accounts", async () => {
    byTable.accounts = { data: [], error: null };
    expect(await getAdminAccounts()).toEqual({ ok: true, data: [] });
  });
});

describe("getAdminAccountDetail", () => {
  const FULL = () => {
    byTable.accounts = {
      error: null,
      data: {
        id: ID,
        name: "Bob's Bakery",
        account_type: "commercial",
        phone: "(315) 555-0101",
        created_at: "2026-11-02T03:30:00Z", // still Nov 1 in New York
        account_members: [
          { email: "carol@biz.com", role: "member" },
          { email: "bob@biz.com", role: "owner" },
        ],
      },
    };
    byTable.service_plans = {
      error: null,
      data: [
        { id: "p1", service_type: "commercial", frequency: "2-3x", address: "9 Oak St", city: "Syracuse", zip: "13202", status: "paused", notes: "Back door" },
        { id: "p2", service_type: "deep", frequency: "monthly", address: "1 Main", city: "Syracuse", zip: "13202", status: "ended", notes: null },
      ],
    };
    byTable.invoices = {
      error: null,
      data: [
        {
          id: "i1", invoice_number: 1007, amount_cents: 12550, description: "Clean", issued_on: "2026-11-02", due_on: "2026-11-30",
          status: "open", paid_on: null, payment_note: null, bookings: null, commercial_quotes: { quote_number: 1007 },
        },
      ],
    };
    byTable.bookings = {
      error: null,
      data: [{ id: "b1", booking_number: 1043, service_type: "standard", scheduled_date: "2026-11-02", status: "confirmed" }],
    };
    byTable.commercial_quotes = { error: null, data: [{ id: "q1", quote_number: 1007, business_name: "Bob's Bakery" }] };
  };

  it("filters every query on the account and reads only the admin-relevant tables", async () => {
    FULL();
    await getAdminAccountDetail(ID);
    expect(recorded.map((q) => q.table).sort()).toEqual(["accounts", "bookings", "commercial_quotes", "invoices", "service_plans"]);
    for (const q of recorded) {
      expect(q.eq).toContainEqual([q.table === "accounts" ? "id" : "account_id", ID]);
    }
  });

  it("bounds the recent bookings and quotes", async () => {
    FULL();
    await getAdminAccountDetail(ID);
    for (const table of ["bookings", "commercial_quotes"]) {
      expect(recorded.find((q) => q.table === table)!.limit).toBe(50);
    }
  });

  it("maps the account, team (owner first), plans, invoices, visits and quotes", async () => {
    FULL();
    const result = await getAdminAccountDetail(ID);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.data) throw new Error("expected data");
    const d = result.data;

    expect(d).toMatchObject({ id: ID, name: "Bob's Bakery", type: "commercial", phone: "(315) 555-0101" });
    // 03:30 UTC on Nov 2 is still Nov 1 in New York.
    expect(d.createdLabel).toBe("November 1, 2026");
    expect(d.members.map((m) => m.email)).toEqual(["bob@biz.com", "carol@biz.com"]);
    expect(d.plans[0]).toMatchObject({
      serviceLabel: "Commercial cleaning",
      frequencyLabel: "2–3x / week",
      status: "paused",
      statusLabel: "Paused",
      notes: "Back door",
    });
    // The admin sees ended plans too.
    expect(d.plans[1]).toMatchObject({ serviceLabel: "Deep Clean", status: "ended" });
    expect(d.invoices[0]).toMatchObject({ number: "INV-1007", amountLabel: "$125.50", quoteRef: "COM-1007" });
    expect(d.visits[0]).toEqual({ id: "b1", ref: "AOC-1043", label: "Standard Clean on November 2, 2026", status: "confirmed" });
    expect(d.quotes[0]).toEqual({ id: "q1", ref: "COM-1007", businessName: "Bob's Bakery" });
  });

  it("returns null data for no such account, and doesn't query a malformed id", async () => {
    FULL();
    byTable.accounts = { data: null, error: null };
    expect(await getAdminAccountDetail(ID)).toEqual({ ok: true, data: null });

    recorded.length = 0;
    for (const id of ["abc", "", "../x", "1 or 1=1"]) {
      expect(await getAdminAccountDetail(id)).toEqual({ ok: true, data: null });
    }
    expect(recorded).toHaveLength(0);
  });

  it.each(["accounts", "service_plans", "invoices", "bookings", "commercial_quotes"])(
    "fails, never a half-empty page, if the %s query fails",
    async (table) => {
      FULL();
      byTable[table] = DB_DOWN;
      expect(await getAdminAccountDetail(ID)).toEqual({ ok: false });
    },
  );
});
