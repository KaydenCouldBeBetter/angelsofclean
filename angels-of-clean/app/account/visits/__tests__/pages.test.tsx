import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CustomerAccount, ServicePlan, VisitDetail } from "@/lib/customer-types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

type Q<T> = { ok: true; data: T } | { ok: false };
const getCustomerAccount = vi.fn<() => Promise<Q<CustomerAccount | null>>>();
const getCustomerVisits = vi.fn<(id: string) => Promise<Q<VisitDetail[]>>>();
const getCustomerVisit = vi.fn<(a: string, id: string) => Promise<Q<VisitDetail | null>>>();
const getServicePlans = vi.fn<(id: string) => Promise<Q<ServicePlan[]>>>();
vi.mock("@/lib/supabase/customer-queries", () => ({
  getCustomerAccount: () => getCustomerAccount(),
  getCustomerVisits: (id: string) => getCustomerVisits(id),
  getCustomerVisit: (a: string, id: string) => getCustomerVisit(a, id),
  getServicePlans: (id: string) => getServicePlans(id),
}));

import VisitsPage from "../page";
import VisitPage from "../[id]/page";

const ACCOUNT: CustomerAccount = { id: "acc-1", name: "Alice Adams", type: "residential", role: "owner" };
const VISIT: VisitDetail = {
  id: "v-1",
  ref: "AOC-1043",
  serviceLabel: "Deep Clean",
  frequencyLabel: "One-time",
  date: "2026-11-24",
  dateLabel: "Tuesday, November 24, 2026",
  timeLabel: "12:00 PM – 4:00 PM",
  address: "1 Main St",
  cityLine: "Syracuse, 13202",
  bedrooms: 1,
  bathroomsLabel: "1 Bathroom",
  status: "confirmed",
  planId: null,
  notes: "Side door\nbeware the dog",
};
const visit = (over: Partial<VisitDetail>): VisitDetail => ({ ...VISIT, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  getCustomerAccount.mockResolvedValue({ ok: true, data: ACCOUNT });
  getCustomerVisits.mockResolvedValue({ ok: true, data: [] });
  getCustomerVisit.mockResolvedValue({ ok: true, data: VISIT });
  getServicePlans.mockResolvedValue({ ok: true, data: [] });
});

describe("visits page", () => {
  const render = async () => renderToStaticMarkup(await VisitsPage());

  it("shows the empty state when there are no visits and no plan", async () => {
    const html = await render();
    expect(html).toContain("No bookings yet");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("lists upcoming soonest first and past most recent first, each linking to its visit", async () => {
    getCustomerVisits.mockResolvedValue({
      ok: true,
      data: [
        visit({ id: "a", date: "2026-12-05", dateLabel: "Saturday, December 5, 2026" }),
        visit({ id: "b", date: "2026-11-12", dateLabel: "Thursday, November 12, 2026" }),
        visit({ id: "c", date: "2026-10-01", dateLabel: "Thursday, October 1, 2026", status: "done" }),
        visit({ id: "d", date: "2026-10-20", dateLabel: "Tuesday, October 20, 2026", status: "done" }),
      ],
    });
    const html = await render();
    const order = ["November 12", "December 5", "October 20", "October 1"].map((d) => html.indexOf(d));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
    expect(html).toContain('href="/account/visits/b"');
    expect(html).toContain('aria-label="Upcoming visits"');
    expect(html).toContain('aria-label="Past visits"');
  });

  it("shows the plan above the visits", async () => {
    getCustomerVisits.mockResolvedValue({ ok: true, data: [visit({})] });
    getServicePlans.mockResolvedValue({
      ok: true,
      data: [
        { id: "p", serviceLabel: "Standard Clean", frequencyLabel: "Weekly", address: "1 Main St", cityLine: "Syracuse, 13202", status: "paused", statusLabel: "Paused" },
      ],
    });
    const html = await render();
    expect(html).toContain("Weekly · Standard Clean");
    expect(html).toContain("Paused");
    expect(html.indexOf("Your service plan")).toBeLessThan(html.indexOf("Upcoming"));
  });

  it("caps past visits at 50 and says so", async () => {
    const past = Array.from({ length: 53 }, (_, i) =>
      visit({ id: `p-${i}`, ref: `AOC-${2000 + i}`, date: `2026-0${(i % 9) + 1}-15`, status: "done" }),
    );
    getCustomerVisits.mockResolvedValue({ ok: true, data: past });
    const html = await render();
    expect(html.match(/href="\/account\/visits\/p-/g)).toHaveLength(50);
    expect(html).toContain("50 most recent");
  });

  it("scopes every read to the account and reports a failure as one", async () => {
    await render();
    expect(getCustomerVisits).toHaveBeenCalledWith("acc-1");
    getCustomerVisits.mockResolvedValue({ ok: false });
    const html = await render();
    expect(html).toContain("We couldn&#x27;t load your visits");
    expect(html).not.toContain("No bookings yet");
  });
});

describe("visit page", () => {
  const render = async (id = "v-1") => renderToStaticMarkup(await VisitPage({ params: Promise.resolve({ id }) }));

  it("shows the visit's details, status and the customer's own notes", async () => {
    const html = await render();
    expect(html).toContain("Deep Clean");
    for (const text of [
      "Tuesday, November 24, 2026",
      "12:00 PM – 4:00 PM",
      "1 Main St, Syracuse, 13202",
      "1 Bedroom · 1 Bathroom",
      "One-time",
      "AOC-1043",
      "Side door",
      "Confirmed",
      "Your visit is confirmed",
    ]) {
      expect(html, text).toContain(text);
    }
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("asks the query for this account's booking only", async () => {
    await render();
    expect(getCustomerVisit).toHaveBeenCalledWith("acc-1", "v-1");
  });

  it("is a 404 for a booking that isn't theirs, doesn't exist, or a login with no account", async () => {
    getCustomerVisit.mockResolvedValue({ ok: true, data: null });
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    getCustomerAccount.mockResolvedValue({ ok: true, data: null });
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("is a load error, not a 404, when the lookup fails", async () => {
    getCustomerVisit.mockResolvedValue({ ok: false });
    expect(await render()).toContain("We couldn&#x27;t load this visit");
  });

  it("omits the notes row when there are none", async () => {
    getCustomerVisit.mockResolvedValue({ ok: true, data: visit({ notes: null }) });
    expect(await render()).not.toContain("Your notes");
  });

  it("escapes the customer's notes", async () => {
    getCustomerVisit.mockResolvedValue({ ok: true, data: visit({ notes: "<script>alert(1)</script>" }) });
    expect(await render()).not.toContain("<script>alert(1)");
  });

  it.each([
    ["pending", "change or cancel"],
    ["confirmed", "change or cancel"],
    ["cancelled", "rebook"],
    ["done", "Questions about this visit"],
    ["active", "Questions about this visit"],
  ] as const)("a %s visit says '%s' next to the business number", async (status, text) => {
    getCustomerVisit.mockResolvedValue({ ok: true, data: visit({ status }) });
    const html = await render();
    expect(html).toContain(text);
    expect(html).toContain("tel:");
  });

  it("never shows a crew, entry instructions, a price or staff notes", async () => {
    const html = await render();
    expect(html).not.toMatch(/crew|cleaner|entry instructions|door code|activity/i);
    expect(html).not.toMatch(/\$\d/);
  });
});
