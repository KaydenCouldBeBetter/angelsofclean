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
  getCustomerInvoice,
  getCustomerInvoices,
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

describe("invoices", () => {
  const INVOICE_ID = "33333333-3333-4333-8333-333333333333";
  const INVOICE = {
    id: INVOICE_ID,
    invoice_number: 1007,
    amount_cents: 12550,
    description: "Standard clean, Nov 2",
    issued_on: "2026-11-02",
    due_on: "2026-11-30",
    status: "open",
    paid_on: null,
    payment_note: null,
    bookings: null,
    commercial_quotes: null,
  };

  it("filters both invoice queries on the account", async () => {
    results = [{ data: [INVOICE], error: null }];
    await getCustomerInvoices(ACCOUNT_ID);
    await getCustomerInvoice(ACCOUNT_ID, INVOICE_ID);
    expect(recorded.map((q) => q.table)).toEqual(["invoices", "invoices"]);
    for (const q of recorded) expect(q.eq).toContainEqual(["account_id", ACCOUNT_ID]);
    expect(recorded[1].eq).toContainEqual(["id", INVOICE_ID]);
  });

  it("never selects who at the office made an invoice, or staff data", async () => {
    await getCustomerInvoices(ACCOUNT_ID);
    await getCustomerInvoice(ACCOUNT_ID, INVOICE_ID);
    for (const q of recorded) {
      expect(q.columns).not.toMatch(/created_by|email|phone|activity|employee/);
    }
  });

  it("keeps the payment note and what it was for to the invoice's own page", async () => {
    await getCustomerInvoices(ACCOUNT_ID);
    await getCustomerInvoice(ACCOUNT_ID, INVOICE_ID);
    expect(recorded[0].columns).not.toMatch(/payment_note|bookings|commercial_quotes/);
    expect(recorded[1].columns).toMatch(/payment_note/);
    expect(recorded[1].columns).toMatch(/bookings\(/);
    // The embedded booking is only its id, type and date, never its contact or notes.
    expect(recorded[1].columns).not.toMatch(/notes|client_name/);
  });

  it("maps an invoice to labels, with the amount from whole cents and NY dates", async () => {
    results = [{ data: [{ ...INVOICE, status: "paid", paid_on: "2026-11-05" }], error: null }];
    const result = await getCustomerInvoices(ACCOUNT_ID);
    expect(recorded[0].order).toEqual(["issued_on", { ascending: false }]);
    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: INVOICE_ID,
          number: "INV-1007",
          description: "Standard clean, Nov 2",
          amountCents: 12550,
          amountLabel: "$125.50",
          issuedOn: "2026-11-02",
          issuedLabel: "November 2, 2026",
          dueOn: "2026-11-30",
          dueLabel: "November 30, 2026",
          status: "paid",
          paidLabel: "November 5, 2026",
        },
      ],
    });
  });

  it("returns a detail with its visit link, quote reference and trimmed note", async () => {
    results = [
      {
        data: {
          ...INVOICE,
          payment_note: "  Check #1042  ",
          bookings: { id: VISIT_ID, service_type: "deep", scheduled_date: "2026-11-02" },
          commercial_quotes: { quote_number: 1007 },
        },
        error: null,
      },
    ];
    const result = await getCustomerInvoice(ACCOUNT_ID, INVOICE_ID);
    expect(result.ok && result.data).toMatchObject({
      number: "INV-1007",
      paymentNote: "  Check #1042  ",
      visit: { id: VISIT_ID, label: "Deep Clean on November 2, 2026" },
      quoteRef: "COM-1007",
    });
  });

  it("has no visit, quote or note when the invoice is a general charge", async () => {
    results = [{ data: INVOICE, error: null }];
    const result = await getCustomerInvoice(ACCOUNT_ID, INVOICE_ID);
    expect(result.ok && result.data).toMatchObject({ paymentNote: null, visit: null, quoteRef: null });
  });

  it("returns null data for an invoice that isn't theirs, and doesn't query a malformed id", async () => {
    results = [{ data: null, error: null }];
    expect(await getCustomerInvoice(ACCOUNT_ID, INVOICE_ID)).toEqual({ ok: true, data: null });
    recorded.length = 0;
    for (const id of ["abc", "", "../x", "1 or 1=1"]) {
      expect(await getCustomerInvoice(ACCOUNT_ID, id)).toEqual({ ok: true, data: null });
    }
    expect(recorded).toHaveLength(0);
  });

  it("fails, rather than showing no invoices, when the database is down", async () => {
    results = [DB_DOWN];
    expect(await getCustomerInvoices(ACCOUNT_ID)).toEqual({ ok: false });
    results = [DB_DOWN];
    expect(await getCustomerInvoice(ACCOUNT_ID, INVOICE_ID)).toEqual({ ok: false });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("57P03");
    expect(logged).not.toContain("Standard clean");
  });

  it("returns an empty list only when there genuinely are none", async () => {
    results = [{ data: [], error: null }];
    expect(await getCustomerInvoices(ACCOUNT_ID)).toEqual({ ok: true, data: [] });
  });
});

// P1: the admin form tells staff "The customer sees these on their account."
describe("service plan notes", () => {
  const PLAN = {
    id: "33333333-3333-4333-8333-333333333333",
    service_type: "standard",
    frequency: "bi-weekly",
    address: "1 Main St",
    city: "Syracuse",
    zip: "13202",
    status: "active",
  };

  it("selects the plan's notes, which the office writes for the customer", async () => {
    await getServicePlans(ACCOUNT_ID);
    expect(recorded[0].columns!.split(",")).toContain("notes");
  });

  it("returns the notes, and leaves them out when blank", async () => {
    results = [
      { data: [{ ...PLAN, notes: "Every other Wednesday" }, { ...PLAN, id: "4", notes: "  " }], error: null },
    ];
    const result = await getServicePlans(ACCOUNT_ID);
    expect(result.ok && result.data.map((p) => p.notes)).toEqual(["Every other Wednesday", undefined]);
  });
});
