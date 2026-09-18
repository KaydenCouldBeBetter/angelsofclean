import { describe, it, expect, vi, beforeEach } from "vitest";

// Chainable postgrest-builder stub — records the columns passed to select()
// and resolves to the given result when awaited.
type QueryResult = { data: unknown; error: unknown };

function makeSupabaseStub(result: QueryResult) {
  const recorded: { table?: string; columns?: string } = {};
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const builder: any = {};
  for (const method of ["order", "eq", "neq", "gt", "lt", "gte", "lte"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.select = vi.fn((columns: string) => {
    recorded.columns = columns;
    return builder;
  });
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const client = {
    from: vi.fn((table: string) => {
      recorded.table = table;
      return builder;
    }),
  };
  return { recorded, client };
}

const createClientMock = vi.fn();
vi.mock("../server", () => ({
  createClient: () => createClientMock(),
}));

import { getJobsInRange, getJobs } from "../queries";

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

    expect(jobs).toEqual([]);
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
