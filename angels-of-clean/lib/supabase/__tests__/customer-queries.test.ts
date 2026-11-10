// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { data: unknown; error: { code?: string } | null };
interface Recorded {
  table: string;
  columns?: string;
  eq: [string, unknown][];
  neq: [string, unknown][];
  order?: [string, unknown];
}

const recorded: Recorded[] = [];
let results: Result[] = [];
const rpc = vi.fn<(fn: string) => Promise<{ error: { code?: string } | null }>>();
const getClaims = vi.fn();

function builderFor(entry: Recorded, result: Result) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const b: any = {};
  b.select = (columns: string) => ((entry.columns = columns), b);
  b.eq = (c: string, v: unknown) => (entry.eq.push([c, v]), b);
  b.neq = (c: string, v: unknown) => (entry.neq.push([c, v]), b);
  b.order = (c: string, o: unknown) => ((entry.order = [c, o]), b);
  // Like the real client: one row (or null), never an array.
  b.maybeSingle = () =>
    Promise.resolve({ ...result, data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data });
  b.then = (resolve: (r: Result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return b;
}

vi.mock("../server", () => ({
  createClient: () =>
    Promise.resolve({
      rpc,
      auth: { getClaims },
      from: (table: string) => {
        const entry: Recorded = { table, eq: [], neq: [] };
        recorded.push(entry);
        return builderFor(entry, results[Math.min(recorded.length - 1, results.length - 1)]);
      },
    }),
}));

import {
  claimCustomerRecords,
  getCustomerAccount,
  getCustomerVisit,
  getCustomerVisits,
  getServicePlans,
} from "../customer-queries";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const VISIT_ID = "22222222-2222-4222-8222-222222222222";

const BOOKING = {
  id: VISIT_ID,
  booking_number: 1043,
  service_type: "standard",
  frequency: "bi-weekly",
  address: "1 Main St",
  city: "Syracuse",
  zip: "13202",
  bedrooms: 3,
  bathrooms: 2.5,
  scheduled_date: "2026-11-02",
  start_at: "2026-11-02T13:00:00Z",
  end_at: "2026-11-02T17:00:00Z",
  status: "confirmed",
  plan_id: null,
  notes: "  Please use the side door  ",
};

const DB_DOWN: Result = { data: null, error: { code: "57P03" } };

beforeEach(() => {
  vi.clearAllMocks();
  recorded.length = 0;
  results = [{ data: [], error: null }];
  vi.spyOn(console, "error").mockImplementation(() => {});
  rpc.mockResolvedValue({ error: null });
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
});

describe("what a customer's queries are scoped to", () => {
  it("filters every query on the account, so an admin session sees one account, not all", async () => {
    results = [{ data: [BOOKING], error: null }];
    await getCustomerVisits(ACCOUNT_ID);
    await getCustomerVisit(ACCOUNT_ID, VISIT_ID);
    await getServicePlans(ACCOUNT_ID);
    expect(recorded).toHaveLength(3);
    for (const q of recorded) expect(q.eq).toContainEqual(["account_id", ACCOUNT_ID]);
  });

  it("only reads customer-facing tables, never staff-only ones", async () => {
    await getCustomerVisits(ACCOUNT_ID);
    await getServicePlans(ACCOUNT_ID);
    await getCustomerAccount();
    const tables = recorded.map((q) => q.table);
    expect(tables.sort()).toEqual(["account_members", "bookings", "service_plans"]);
    for (const forbidden of ["activity_log", "booking_access", "booking_employees", "employees", "accounts"]) {
      expect(tables).not.toContain(forbidden);
    }
  });

  it("keeps contact details, staff data and entry instructions out of every column list", async () => {
    await getCustomerVisits(ACCOUNT_ID);
    await getCustomerVisit(ACCOUNT_ID, VISIT_ID);
    for (const q of recorded) {
      const columns = q.columns!.split(",").map((c) => c.trim());
      for (const column of ["email", "phone", "client_name", "booking_employees", "booking_access", "activity_log"]) {
        expect(columns, `${q.table} selects ${column}`).not.toContain(column);
      }
    }
  });

  it("shows notes on a visit's own page only, never in the list", async () => {
    await getCustomerVisits(ACCOUNT_ID);
    await getCustomerVisit(ACCOUNT_ID, VISIT_ID);
    expect(recorded[0].columns!.split(",")).not.toContain("notes");
    expect(recorded[1].columns!.split(",")).toContain("notes");
  });
});

describe("getCustomerAccount", () => {
  const MEMBERSHIP = { role: "owner", accounts: { id: ACCOUNT_ID, name: "Bob's Bakery", account_type: "commercial" } };

  it("reads the signed-in user's own membership, never the accounts table", async () => {
    results = [{ data: MEMBERSHIP, error: null }];
    const result = await getCustomerAccount();
    expect(recorded[0].table).toBe("account_members");
    expect(recorded[0].eq).toContainEqual(["user_id", "user-1"]);
    expect(result).toEqual({
      ok: true,
      data: { id: ACCOUNT_ID, name: "Bob's Bakery", type: "commercial", role: "owner" },
    });
  });

  it("returns null data, not a failure, for a user with no account", async () => {
    results = [{ data: null, error: null }];
    expect(await getCustomerAccount()).toEqual({ ok: true, data: null });
  });

  it("fails when the session has no user or the lookup errors", async () => {
    getClaims.mockResolvedValue({ data: null, error: { name: "AuthSessionMissingError" } });
    expect(await getCustomerAccount()).toEqual({ ok: false });
    expect(recorded).toHaveLength(0);

    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
    results = [DB_DOWN];
    expect(await getCustomerAccount()).toEqual({ ok: false });
  });
});

describe("getCustomerVisits", () => {
  it("maps rows to the labels the portal shows, in New York time", async () => {
    results = [{ data: [BOOKING], error: null }];
    const result = await getCustomerVisits(ACCOUNT_ID);
    expect(recorded[0].order).toEqual(["start_at", { ascending: true }]);
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: VISIT_ID,
          ref: "AOC-1043",
          serviceLabel: "Standard Clean",
          frequencyLabel: "Bi-weekly",
          date: "2026-11-02",
          dateLabel: "Monday, November 2, 2026",
          timeLabel: "8:00 AM – 12:00 PM",
          address: "1 Main St",
          cityLine: "Syracuse, 13202",
          bedrooms: 3,
          bathroomsLabel: "2.5 Bathrooms",
          status: "confirmed",
          planId: null,
        },
      ],
    });
  });

  it("shows an admin's custom window as stored, not as a slot name", async () => {
    results = [{ data: [{ ...BOOKING, start_at: "2026-11-02T14:30:00Z", end_at: "2026-11-02T16:00:00Z" }], error: null }];
    const result = await getCustomerVisits(ACCOUNT_ID);
    expect(result.ok && result.data[0].timeLabel).toBe("9:30 AM – 11:00 AM");
  });

  it("returns an empty list only when there genuinely are none", async () => {
    results = [{ data: [], error: null }];
    expect(await getCustomerVisits(ACCOUNT_ID)).toEqual({ ok: true, data: [] });
  });

  it("fails, logging only a code, when the database is down", async () => {
    results = [DB_DOWN];
    expect(await getCustomerVisits(ACCOUNT_ID)).toEqual({ ok: false });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("57P03");
    expect(logged).not.toContain("Main St");
  });
});

describe("getCustomerVisit", () => {
  it("returns the visit with the customer's trimmed notes", async () => {
    results = [{ data: BOOKING, error: null }];
    const result = await getCustomerVisit(ACCOUNT_ID, VISIT_ID);
    expect(recorded[0].eq).toContainEqual(["id", VISIT_ID]);
    expect(result.ok && result.data?.notes).toBe("  Please use the side door  ");
  });

  it("turns blank notes into null", async () => {
    results = [{ data: { ...BOOKING, notes: "   " }, error: null }];
    const result = await getCustomerVisit(ACCOUNT_ID, VISIT_ID);
    expect(result.ok && result.data?.notes).toBeNull();
  });

  it("returns null data for a booking that isn't theirs or doesn't exist", async () => {
    results = [{ data: null, error: null }];
    expect(await getCustomerVisit(ACCOUNT_ID, VISIT_ID)).toEqual({ ok: true, data: null });
  });

  it.each(["abc", "", "../etc/passwd", "1; drop table bookings", `${VISIT_ID}x`])(
    "doesn't query for the malformed id %j",
    async (id) => {
      expect(await getCustomerVisit(ACCOUNT_ID, id)).toEqual({ ok: true, data: null });
      expect(recorded).toHaveLength(0);
    },
  );

  it("fails, rather than reporting not found, when the lookup errors", async () => {
    results = [DB_DOWN];
    expect(await getCustomerVisit(ACCOUNT_ID, VISIT_ID)).toEqual({ ok: false });
  });
});

describe("getServicePlans", () => {
  const PLAN = {
    id: "p-1",
    service_type: "standard",
    frequency: "bi-weekly",
    address: "1 Main St",
    city: "Syracuse",
    zip: "13202",
    status: "active",
  };

  it("maps a plan and asks the database to skip ended ones", async () => {
    results = [{ data: [PLAN, { ...PLAN, id: "p-2", status: "paused" }], error: null }];
    const result = await getServicePlans(ACCOUNT_ID);
    expect(recorded[0].neq).toContainEqual(["status", "ended"]);
    expect(result).toEqual({
      ok: true,
      data: [
        { id: "p-1", serviceLabel: "Standard Clean", frequencyLabel: "Bi-weekly", address: "1 Main St", cityLine: "Syracuse, 13202", status: "active", statusLabel: "Active" },
        { id: "p-2", serviceLabel: "Standard Clean", frequencyLabel: "Bi-weekly", address: "1 Main St", cityLine: "Syracuse, 13202", status: "paused", statusLabel: "Paused" },
      ],
    });
  });

  it("drops an ended plan even if one slips through", async () => {
    results = [{ data: [{ ...PLAN, status: "ended" }], error: null }];
    expect(await getServicePlans(ACCOUNT_ID)).toEqual({ ok: true, data: [] });
  });

  it("labels a commercial plan with the commercial frequencies", async () => {
    results = [{ data: [{ ...PLAN, service_type: "commercial", frequency: "2-3x" }], error: null }];
    const result = await getServicePlans(ACCOUNT_ID);
    expect(result.ok && result.data[0]).toMatchObject({
      serviceLabel: "Commercial cleaning",
      frequencyLabel: "2–3x / week",
    });
  });

  it("fails when the database is down", async () => {
    results = [DB_DOWN];
    expect(await getServicePlans(ACCOUNT_ID)).toEqual({ ok: false });
  });
});

describe("claimCustomerRecords", () => {
  it("asks the database to link this email's bookings", async () => {
    await claimCustomerRecords();
    expect(rpc).toHaveBeenCalledWith("claim_account_records");
  });

  it("never throws on a failure; the portal just shows what the account already has", async () => {
    rpc.mockResolvedValue({ error: { code: "42501" } });
    await expect(claimCustomerRecords()).resolves.toBeUndefined();
  });
});
