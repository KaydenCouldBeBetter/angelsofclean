import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const getJobByIdMock = vi.fn();
const getActivityLogMock = vi.fn();
const getEmployeesMock = vi.fn();
const getBookingAccessMock = vi.fn();
vi.mock("@/lib/supabase/queries", () => ({
  getJobById: (id: string) => getJobByIdMock(id),
  getActivityLog: (id: string) => getActivityLogMock(id),
  getEmployees: () => getEmployeesMock(),
  getBookingAccess: (id: string) => getBookingAccessMock(id),
}));

// Client components the page renders; not what these tests are about.
vi.mock("../BookingActions", () => ({ default: () => null }));
vi.mock("../EntryInstructions", () => ({ default: () => null }));
vi.mock("../../../LoadError", () => ({
  default: ({ what }: { what: string }) => <p>couldn&apos;t load {what}</p>,
}));

import BookingDetailPage from "../page";

async function render(id: string) {
  return renderToStaticMarkup(await BookingDetailPage({ params: Promise.resolve({ id }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  getJobByIdMock.mockResolvedValue({ ok: true, data: null });
  getActivityLogMock.mockResolvedValue({ ok: true, data: [] });
  getEmployeesMock.mockResolvedValue({ ok: true, data: [] });
  getBookingAccessMock.mockResolvedValue({ ok: true, data: null });
});

describe("BookingDetailPage", () => {
  it.each(["not-a-uuid", "1042", "abc-123", "' or 1=1 --"])(
    "shows not found, without querying, for a malformed id (%s)",
    async (id) => {
      const html = await render(id);

      expect(html).toContain("Booking not found");
      expect(html).not.toContain("couldn&#x27;t load");
      expect(getJobByIdMock).not.toHaveBeenCalled();
    },
  );

  it("shows not found for a well-formed id with no booking", async () => {
    const html = await render("3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b");

    expect(html).toContain("Booking not found");
    expect(getJobByIdMock).toHaveBeenCalledWith("3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b");
  });

  it("still shows couldn't load when the lookup itself fails", async () => {
    getJobByIdMock.mockResolvedValue({ ok: false });

    const html = await render("3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b");

    expect(html).toContain("load this booking");
    expect(html).not.toContain("Booking not found");
  });
});
