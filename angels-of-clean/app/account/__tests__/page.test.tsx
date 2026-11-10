import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CustomerAccount, Invoice, ServicePlan, Visit } from "@/lib/customer-types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

type Q<T> = { ok: true; data: T } | { ok: false };
const claimCustomerRecords = vi.fn(() => Promise.resolve());
const getCustomerAccount = vi.fn<() => Promise<Q<CustomerAccount | null>>>();
const getCustomerVisits = vi.fn<(id: string) => Promise<Q<Visit[]>>>();
const getServicePlans = vi.fn<(id: string) => Promise<Q<ServicePlan[]>>>();
const getCustomerInvoices = vi.fn<(id: string) => Promise<Q<Invoice[]>>>();
vi.mock("@/lib/supabase/customer-queries", () => ({
  getCustomerInvoices: (id: string) => getCustomerInvoices(id),
  claimCustomerRecords: () => claimCustomerRecords(),
  getCustomerAccount: () => getCustomerAccount(),
  getCustomerVisits: (id: string) => getCustomerVisits(id),
  getServicePlans: (id: string) => getServicePlans(id),
}));

import AccountOverviewPage from "../page";

const ACCOUNT: CustomerAccount = { id: "acc-1", name: "Alice Adams", type: "residential", role: "owner" };

function visit(over: Partial<Visit>): Visit {
  return {
    id: "v-1",
    ref: "AOC-1043",
    serviceLabel: "Standard Clean",
    frequencyLabel: "Bi-weekly",
    date: "2026-11-24",
    dateLabel: "Tuesday, November 24, 2026",
    timeLabel: "8:00 AM – 12:00 PM",
    address: "1 Main St",
    cityLine: "Syracuse, 13202",
    bedrooms: 3,
    bathroomsLabel: "2.5 Bathrooms",
    status: "confirmed",
    planId: null,
    ...over,
  };
}

const PLAN: ServicePlan = {
  id: "p-1",
  serviceLabel: "Standard Clean",
  frequencyLabel: "Bi-weekly",
  address: "1 Main St",
  cityLine: "Syracuse, 13202",
  status: "active",
  statusLabel: "Active",
};

function invoice(over: Partial<Invoice>): Invoice {
  return {
    id: "i-1",
    number: "INV-1007",
    description: "Standard clean",
    amountCents: 12500,
    amountLabel: "$125.00",
    issuedOn: "2026-11-02",
    issuedLabel: "November 2, 2026",
    dueOn: "2026-11-30",
    dueLabel: "November 30, 2026",
    status: "open",
    paidLabel: null,
    ...over,
  };
}

const render = async (searchParams: { invite?: string } = {}) =>
  renderToStaticMarkup(await AccountOverviewPage({ searchParams: Promise.resolve(searchParams) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  getCustomerAccount.mockResolvedValue({ ok: true, data: ACCOUNT });
  getCustomerVisits.mockResolvedValue({ ok: true, data: [] });
  getServicePlans.mockResolvedValue({ ok: true, data: [] });
  getCustomerInvoices.mockResolvedValue({ ok: true, data: [] });
});
afterEach(() => vi.useRealTimers());

describe("account overview", () => {
  it("picks up bookings made since sign-up before reading anything", async () => {
    await render();
    expect(claimCustomerRecords).toHaveBeenCalled();
    expect(claimCustomerRecords.mock.invocationCallOrder[0]).toBeLessThan(
      getCustomerVisits.mock.invocationCallOrder[0],
    );
  });

  it("reads only the signed-in account's records", async () => {
    await render();
    expect(getCustomerVisits).toHaveBeenCalledWith("acc-1");
    expect(getServicePlans).toHaveBeenCalledWith("acc-1");
  });

  it("greets the account by name, with one h1, and escapes the name", async () => {
    getCustomerAccount.mockResolvedValue({ ok: true, data: { ...ACCOUNT, name: "<img src=x onerror=alert(1)>" } });
    const html = await render();
    expect(html).not.toContain("<img");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("shows the empty state, with the booking path for the account type", async () => {
    let html = await render();
    expect(html).toContain("No bookings yet");
    expect(html).toContain('href="/residential"');
    expect(html).toContain("Book a cleaning");

    getCustomerAccount.mockResolvedValue({ ok: true, data: { ...ACCOUNT, type: "commercial" } });
    html = await render();
    expect(html).toContain('href="/commercial"');
    expect(html).toContain("Get a commercial quote");
  });

  it("shows the next upcoming visit, its plan, and recent visits", async () => {
    getCustomerVisits.mockResolvedValue({
      ok: true,
      data: [
        visit({ id: "v-next", date: "2026-11-12", dateLabel: "Thursday, November 12, 2026", status: "pending" }),
        visit({ id: "v-later", date: "2026-11-26", dateLabel: "Thursday, November 26, 2026" }),
        visit({ id: "v-done", date: "2026-10-29", dateLabel: "Thursday, October 29, 2026", status: "done" }),
      ],
    });
    getServicePlans.mockResolvedValue({ ok: true, data: [PLAN] });
    const html = await render();

    const next = html.slice(html.indexOf('id="next-visit"'), html.indexOf('id="service-plan"'));
    expect(next).toContain("Thursday, November 12, 2026");
    expect(next).toContain('href="/account/visits/v-next"');
    expect(next).toContain("Awaiting confirmation");
    expect(next).not.toContain("November 26");

    expect(html).toContain("Bi-weekly · Standard Clean");
    expect(html).toContain("Active");

    const recent = html.slice(html.indexOf('id="recent-visits"'));
    expect(recent).toContain("Thursday, October 29, 2026");
    expect(recent).toContain("Completed");
    expect(recent).toContain('href="/account/visits"');
  });

  it("tells a customer with only past visits that nothing is coming up", async () => {
    getCustomerVisits.mockResolvedValue({ ok: true, data: [visit({ date: "2026-10-01", status: "done" })] });
    const html = await render();
    expect(html).toContain("You don&#x27;t have a visit coming up.");
  });

  it("invites a customer with no plan to call, with the business number", async () => {
    getCustomerVisits.mockResolvedValue({ ok: true, data: [visit({})] });
    const html = await render();
    expect(html).toContain("recurring plan yet");
    expect(html).toContain("tel:");
  });

  it("never shows a price on the visit and plan cards, or a crew or entry instructions", async () => {
    getCustomerVisits.mockResolvedValue({ ok: true, data: [visit({})] });
    getServicePlans.mockResolvedValue({ ok: true, data: [PLAN] });
    const html = await render();
    expect(html).not.toMatch(/\$\d/);
    expect(html).not.toMatch(/crew|cleaner|entry instructions|door code/i);
  });

  describe("billing card", () => {
    beforeEach(() => {
      getCustomerVisits.mockResolvedValue({ ok: true, data: [visit({})] });
    });

    it("shows what is owed, how many invoices are open, and how many are past due", async () => {
      getCustomerInvoices.mockResolvedValue({
        ok: true,
        data: [
          invoice({ id: "a", amountCents: 12500, dueOn: "2026-11-30" }),
          invoice({ id: "b", amountCents: 7550, dueOn: "2026-10-30" }),
          invoice({ id: "c", amountCents: 99900, status: "paid", paidLabel: "x" }),
        ],
      });
      const html = await render();
      const card = html.slice(html.indexOf('id="billing"'));
      expect(card).toContain("$200.50");
      expect(card).toContain("2 open invoices");
      expect(card).toContain("1 past due");
      expect(card).toContain('href="/account/billing"');
    });

    it("says paid up when nothing is open", async () => {
      getCustomerInvoices.mockResolvedValue({ ok: true, data: [invoice({ status: "paid", paidLabel: "x" })] });
      const html = await render();
      expect(html).toContain("$0.00");
      expect(html).toContain("all paid up");
    });

    it("leaves the card out when there are no invoices", async () => {
      expect(await render()).not.toContain('id="billing"');
    });

    it("shows a billing outage on its own, without hiding the visits", async () => {
      getCustomerInvoices.mockResolvedValue({ ok: false });
      const html = await render();
      expect(html).toContain("We couldn&#x27;t load your billing");
      expect(html).toContain("Next visit");
      expect(html).toContain("Tuesday, November 24, 2026");
    });

    it("reads invoices for this account only", async () => {
      await render();
      expect(getCustomerInvoices).toHaveBeenCalledWith("acc-1");
    });

    it("still shows billing to an account with an invoice but no visits or plan yet", async () => {
      getCustomerVisits.mockResolvedValue({ ok: true, data: [] });
      getCustomerInvoices.mockResolvedValue({ ok: true, data: [invoice({})] });
      const html = await render();
      expect(html).not.toContain("No bookings yet");
      expect(html).toContain("$125.00");
    });
  });

  it("says it is a connection problem, not an empty list, when a query fails", async () => {
    getCustomerVisits.mockResolvedValue({ ok: false });
    const html = await render();
    expect(html).toContain("We couldn&#x27;t load your visits");
    expect(html).not.toContain("No bookings yet");

    getCustomerAccount.mockResolvedValue({ ok: false });
    expect(await render()).toContain("We couldn&#x27;t load your account");
  });

  it("explains a login with no customer account, and points staff to their portal", async () => {
    getCustomerAccount.mockResolvedValue({ ok: true, data: null });
    const html = await render();
    expect(html).toContain("isn&#x27;t linked to a customer account");
    expect(html).toContain('href="/admin/dashboard"');
    expect(getCustomerVisits).not.toHaveBeenCalled();
  });

  it("words only the invite notices it knows", async () => {
    expect(await render({ invite: "wrong_email" })).toContain("different email address");
    const unknown = await render({ invite: "<script>alert(1)</script>" });
    expect(unknown).not.toContain("alert(1)");
  });
});
