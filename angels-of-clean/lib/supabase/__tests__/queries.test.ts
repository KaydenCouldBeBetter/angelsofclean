import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Chainable postgrest-builder stub — records the columns passed to select()
// and resolves to the given result when awaited.
type QueryResult = { data: unknown; error: unknown; count?: number | null };

// Pass several results to answer successive from() calls in order (the last
// one repeats) — getDashboardStats runs four queries.
function makeSupabaseStub(...results: QueryResult[]) {
  // table/columns hold the last query; `queries` keeps every one, in order.
  const recorded: {
    table?: string;
    columns?: string;
    queries: { table: string; columns?: string; eq: [string, unknown][] }[];
  } = { queries: [] };
  let call = 0;

  function makeBuilder(result: QueryResult) {
    const query = recorded.queries[recorded.queries.length - 1];
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const builder: any = {};
    for (const method of ["order", "neq", "gt", "lt", "gte", "lte"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.eq = vi.fn((column: string, value: unknown) => {
      query.eq.push([column, value]);
      return builder;
    });
    builder.select = vi.fn((columns: string) => {
      recorded.columns = columns;
      query.columns = columns;
      return builder;
    });
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    builder.then = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    return builder;
  }

  const client = {
    from: vi.fn((table: string) => {
      recorded.table = table;
      recorded.queries.push({ table, eq: [] });
      const result = results[Math.min(call, results.length - 1)];
      call += 1;
      return makeBuilder(result);
    }),
  };
  return { recorded, client };
}

const DB_DOWN: QueryResult = { data: null, error: { code: "57P03", message: "cannot connect" } };

const BOOKING_ROW = {
  id: "b-1",
  booking_number: 1001,
  client_name: "Jane Doe",
  email: "jane@example.com",
  phone: "(315) 555-0100",
  service_type: "standard",
  frequency: "one-time",
  address: "1 Main St",
  city: "Cicero",
  bedrooms: 2,
  bathrooms: 1,
  notes: null,
  start_at: "2026-09-15T12:00:00.000Z",
  end_at: "2026-09-15T16:00:00.000Z",
  status: "pending",
  submitted_at: "2026-09-10T15:00:00.000Z",
  booking_employees: [],
};

const createClientMock = vi.fn();
vi.mock("../server", () => ({
  createClient: () => createClientMock(),
}));

import {
  getActivityLog,
  getBookingAccess,
  getCommercialQuotes,
  getDashboardStats,
  getEmployees,
  getJobById,
  getJobs,
  getJobsByDateFilter,
  getJobsInRange,
  getTodayJobs,
} from "../queries";

describe("getJobsInRange (calendar projection)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never selects email, phone, or notes — the calendar UI renders none of them", async () => {
    const { recorded, client } = makeSupabaseStub({ data: [], error: null });
    createClientMock.mockResolvedValue(client);

    await getJobsInRange("2026-09-01", "2026-09-30");

    expect(recorded.table).toBe("bookings");
    const columns = recorded.columns!.split(",");
    expect(columns).not.toContain("email");
    expect(columns).not.toContain("phone");
    expect(columns).not.toContain("notes");
    // Sanity check: the fields the calendar actually renders are still there.
    expect(columns).toContain("client_name");
    expect(columns).toContain("start_at");
    expect(columns).toContain("status");
  });

  it("keeps the crew embed, so the calendar can tell which jobs have nobody assigned (B15)", async () => {
    const { recorded, client } = makeSupabaseStub({
      data: [
        { ...BOOKING_ROW, id: "no-crew", booking_employees: [] },
        { ...BOOKING_ROW, id: "crewed", booking_employees: [{ employee_id: "e-1" }] },
      ],
      error: null,
    });
    createClientMock.mockResolvedValue(client);

    const result = await getJobsInRange("2026-09-01", "2026-09-30");

    expect(recorded.columns).toContain("booking_employees(employee_id)");
    expect(result).toMatchObject({
      ok: true,
      data: [
        { id: "no-crew", employeeIds: [] },
        { id: "crewed", employeeIds: ["e-1"] },
      ],
    });
  });

  it("logs only the error code and a correlation id when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeSupabaseStub({
      data: null,
      error: {
        code: "42501",
        message: "row echo: jane@example.com (315) 555-0100",
        details: "gate code 4321",
      },
    });
    createClientMock.mockResolvedValue(client);

    const jobs = await getJobsInRange("2026-09-01", "2026-09-30");

    expect(jobs).toEqual({ ok: false });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("42501");
    expect(logged).not.toContain("jane@example.com");
    expect(logged).not.toContain("gate code 4321");
    consoleSpy.mockRestore();
  });
});

describe("getJobs (bookings list projection)", () => {
  it("still selects contact fields — the bookings pages search and display them", async () => {
    const { recorded, client } = makeSupabaseStub({ data: [], error: null });
    createClientMock.mockResolvedValue(client);

    await getJobs();

    const columns = recorded.columns!.split(",");
    expect(columns).toContain("email");
    expect(columns).toContain("phone");
    expect(columns).toContain("notes");
  });
});

describe("getJobsByDateFilter (client bookings-list projection)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps email/phone for search but omits notes — BookingsList is a client component that renders no notes", async () => {
    const { recorded, client } = makeSupabaseStub({ data: [], error: null });
    createClientMock.mockResolvedValue(client);

    await getJobsByDateFilter("today");

    expect(recorded.table).toBe("bookings");
    const columns = recorded.columns!.split(",");
    // email/phone are needed for the list's client-side search.
    expect(columns).toContain("email");
    expect(columns).toContain("phone");
    // notes can hold entry/access instructions and is never rendered in the
    // list, so it must not be serialized to the browser.
    expect(columns).not.toContain("notes");
  });
});

// B18 — an outage must never be reported as an empty result.
describe("failed queries are distinguishable from empty results", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it.each([
    ["getEmployees", () => getEmployees()],
    ["getJobs", () => getJobs()],
    ["getJobsByDateFilter", () => getJobsByDateFilter("today")],
    ["getTodayJobs", () => getTodayJobs()],
    ["getJobsInRange", () => getJobsInRange("2026-09-01", "2026-09-30")],
    ["getActivityLog", () => getActivityLog("b-1")],
    ["getCommercialQuotes", () => getCommercialQuotes()],
  ])("%s reports a database error as { ok: false }, and no rows as an empty list", async (_name, run) => {
    createClientMock.mockResolvedValue(makeSupabaseStub(DB_DOWN).client);
    expect(await run()).toEqual({ ok: false });
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    createClientMock.mockResolvedValue(makeSupabaseStub({ data: [], error: null }).client);
    expect(await run()).toEqual({ ok: true, data: [] });
  });

  it("getJobById tells a missing booking apart from a failed lookup", async () => {
    createClientMock.mockResolvedValue(makeSupabaseStub({ data: null, error: null }).client);
    expect(await getJobById("missing")).toEqual({ ok: true, data: null });
    expect(consoleSpy).not.toHaveBeenCalled();

    createClientMock.mockResolvedValue(makeSupabaseStub(DB_DOWN).client);
    expect(await getJobById("b-1")).toEqual({ ok: false });

    createClientMock.mockResolvedValue(makeSupabaseStub({ data: BOOKING_ROW, error: null }).client);
    const found = await getJobById("b-1");
    expect(found).toMatchObject({ ok: true, data: { id: "b-1", client: "Jane Doe" } });
  });

  it("getDashboardStats returns real zeros when the day is genuinely empty", async () => {
    createClientMock.mockResolvedValue(
      makeSupabaseStub({ data: [], error: null, count: 0 }).client,
    );

    expect(await getDashboardStats()).toEqual({
      ok: true,
      data: { todayJobs: [], totalPending: 0, completedThisWeek: 0, totalEmployees: 0 },
    });
  });

  it("getDashboardStats fails as a whole when any one of its queries fails", async () => {
    const ok = { data: [], error: null, count: 3 };
    // Order of from() calls: today's jobs, pending count, completed count, employee count.
    for (const failingIndex of [0, 1, 2, 3]) {
      const results = [ok, ok, ok, ok].map((r, i) => (i === failingIndex ? DB_DOWN : r));
      createClientMock.mockResolvedValue(makeSupabaseStub(...results).client);

      expect(await getDashboardStats()).toEqual({ ok: false });
    }
  });
});

describe("getCommercialQuotes", () => {
  it("maps a stored quote to what the admin Quotes page shows, in New York time", async () => {
    const { recorded, client } = makeSupabaseStub({
      data: [
        {
          id: "q-1",
          quote_number: 1007,
          business_name: "Northside Dental",
          contact_name: "Dana Lee",
          email: "dana@example.com",
          phone: "(315) 555-0100",
          facility_type: "medical",
          sqft_range: "2k-5k",
          address: "100 Clinton Sq",
          city: "Syracuse",
          zip: "13202",
          floors: 1,
          service_areas: ["lobbies", "restrooms"],
          frequency: "2-3x",
          schedule_preference: null,
          notes: null,
          // 2:30 PM UTC = 10:30 AM in New York (EDT).
          submitted_at: "2026-09-15T14:30:00.000Z",
        },
      ],
      error: null,
    });
    createClientMock.mockResolvedValue(client);

    const result = await getCommercialQuotes();

    expect(recorded.table).toBe("commercial_quotes");
    expect(result).toMatchObject({
      ok: true,
      data: [
        {
          id: "q-1",
          quoteRef: "COM-1007",
          businessName: "Northside Dental",
          contactName: "Dana Lee",
          email: "dana@example.com",
          phone: "(315) 555-0100",
          facility: "Medical · 2,000 – 5,000 sq ft · 1 floor",
          address: "100 Clinton Sq, Syracuse 13202",
          serviceAreas: ["Lobbies & Reception", "Restrooms"],
          frequency: "2–3x / Week",
          schedulePreference: undefined,
          notes: undefined,
        },
      ],
    });
    const submittedAt = result.ok ? result.data[0].submittedAt : "";
    expect(submittedAt).toContain("10:30");
    expect(submittedAt).toContain("AM");
  });
});

// B38: entry instructions (door codes) live in booking_access, which only the
// booking detail page reads.
describe("entry instructions stay out of every list, calendar and dashboard query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["getJobs", () => getJobs()],
    ["getJobsByDateFilter today", () => getJobsByDateFilter("today")],
    ["getJobsByDateFilter upcoming", () => getJobsByDateFilter("upcoming")],
    ["getJobsByDateFilter past", () => getJobsByDateFilter("past")],
    ["getJobsByDateFilter all", () => getJobsByDateFilter("all")],
    ["getTodayJobs", () => getTodayJobs()],
    ["getJobsInRange (calendar)", () => getJobsInRange("2026-09-01", "2026-09-30")],
    ["getDashboardStats", () => getDashboardStats()],
    ["getJobById", () => getJobById("b-1"), BOOKING_ROW],
  ] as [string, () => Promise<unknown>, unknown?][])("%s never reads booking_access", async (_name, run, row = [BOOKING_ROW]) => {
    const { recorded, client } = makeSupabaseStub({ data: row, error: null, count: 0 });
    createClientMock.mockResolvedValue(client);

    await run();

    expect(recorded.queries.length).toBeGreaterThan(0);
    for (const query of recorded.queries) {
      expect(query.table).not.toBe("booking_access");
      // Not embedded either (bookings → booking_access is one-to-one).
      expect(query.columns ?? "").not.toMatch(/booking_access|instructions/);
    }
  });
});

describe("getBookingAccess (booking detail page only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads only the instructions column for the one booking", async () => {
    const { recorded, client } = makeSupabaseStub({
      data: { instructions: "Side gate code 4412" },
      error: null,
    });
    createClientMock.mockResolvedValue(client);

    const result = await getBookingAccess("b-1");

    expect(result).toEqual({ ok: true, data: "Side gate code 4412" });
    expect(recorded.queries).toEqual([
      { table: "booking_access", columns: "instructions", eq: [["booking_id", "b-1"]] },
    ]);
  });

  it("returns null when none were given", async () => {
    const { client } = makeSupabaseStub({ data: null, error: null });
    createClientMock.mockResolvedValue(client);

    expect(await getBookingAccess("b-1")).toEqual({ ok: true, data: null });
  });

  it("fails without logging anything but the code when the lookup fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeSupabaseStub({
      data: null,
      error: { code: "42501", message: "row echo: Side gate code 4412" },
    });
    createClientMock.mockResolvedValue(client);

    expect(await getBookingAccess("b-1")).toEqual({ ok: false });
    const logged = JSON.stringify(consoleSpy.mock.calls);
    expect(logged).toContain("42501");
    expect(logged).not.toContain("4412");
    consoleSpy.mockRestore();
  });
});
