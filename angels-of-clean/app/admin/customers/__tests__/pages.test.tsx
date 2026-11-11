import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdminAccountDetail, AdminAccountSummary } from "@/lib/admin-customer-types";

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
vi.mock("../actions", () => ({
  createServicePlan: vi.fn(),
  setServicePlanStatus: vi.fn(),
  createInvoice: vi.fn(),
  markInvoicePaid: vi.fn(),
  voidInvoice: vi.fn(),
  reopenInvoice: vi.fn(),
  linkBookingToAccount: vi.fn(),
}));

type Q<T> = { ok: true; data: T } | { ok: false };
const getAdminAccounts = vi.fn<() => Promise<Q<AdminAccountSummary[]>>>();
const getAdminAccountDetail = vi.fn<(id: string) => Promise<Q<AdminAccountDetail | null>>>();
vi.mock("@/lib/supabase/admin-customer-queries", () => ({
  getAdminAccounts: () => getAdminAccounts(),
  getAdminAccountDetail: (id: string) => getAdminAccountDetail(id),
}));

import CustomersPage from "../page";
import CustomerPage from "../[id]/page";

const SUMMARY: AdminAccountSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bob's Bakery",
  type: "commercial",
  ownerEmail: "bob@biz.com",
  memberCount: 2,
  visitCount: 7,
  planCount: 1,
  openInvoiceCount: 2,
  openBalanceCents: 20050,
};

const DETAIL: AdminAccountDetail = {
  id: SUMMARY.id,
  name: "Bob's Bakery",
  type: "commercial",
  phone: "(315) 555-0101",
  createdLabel: "November 1, 2026",
  members: [
    { email: "bob@biz.com", role: "owner" },
    { email: "carol@biz.com", role: "member" },
  ],
  plans: [],
  invoices: [],
  visits: [{ id: "b1", ref: "AOC-1043", label: "Standard Clean on November 2, 2026", status: "confirmed" }],
  quotes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  getAdminAccounts.mockResolvedValue({ ok: true, data: [SUMMARY] });
  getAdminAccountDetail.mockResolvedValue({ ok: true, data: DETAIL });
});

describe("admin customers list", () => {
  const render = async () => renderToStaticMarkup(await CustomersPage());

  it("shows each account in a table with a link to its page, and the balance owed", async () => {
    const html = await render();
    expect(html).toContain('href="/admin/customers/11111111-1111-4111-8111-111111111111"');
    expect(html).toContain("Bob&#x27;s Bakery");
    expect(html).toContain("bob@biz.com");
    expect(html).toContain("2 people");
    expect(html).toContain("$200.50");
    expect(html).toContain("2 open");
    expect(html).toContain("Business");
    expect(html).toContain("<caption");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("says None when nothing is owed, and Home for a residential account", async () => {
    getAdminAccounts.mockResolvedValue({
      ok: true,
      data: [{ ...SUMMARY, type: "residential", openInvoiceCount: 0, openBalanceCents: 0, memberCount: 1 }],
    });
    const html = await render();
    expect(html).toContain("None");
    expect(html).toContain("Home");
    expect(html).not.toContain("people");
  });

  it("explains an empty list, and a failure is not an empty list", async () => {
    getAdminAccounts.mockResolvedValue({ ok: true, data: [] });
    expect(await render()).toContain("No customer accounts yet");
    getAdminAccounts.mockResolvedValue({ ok: false });
    const html = await render();
    expect(html).toContain("couldn&#x27;t load customer accounts");
    expect(html).not.toContain("No customer accounts yet");
  });
});

describe("admin customer page", () => {
  const render = async (id = SUMMARY.id) => renderToStaticMarkup(await CustomerPage({ params: Promise.resolve({ id }) }));

  it("shows the account, its logins, plans, invoices and visits with a way to link a booking", async () => {
    const html = await render();
    for (const text of ["Bob&#x27;s Bakery", "Business account", "November 1, 2026", "(315) 555-0101", "bob@biz.com", "Owner", "carol@biz.com", "Member", "Service plans", "Invoices", "Visits", "AOC-1043", "Link another booking"]) {
      expect(html, text).toContain(text);
    }
    expect(html).toContain('href="/admin/bookings/b1"');
    expect(html).toContain('href="/admin/customers"');
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("explains the empty states", async () => {
    getAdminAccountDetail.mockResolvedValue({ ok: true, data: { ...DETAIL, visits: [], members: [] } });
    const html = await render();
    expect(html).toContain("No service plan yet.");
    expect(html).toContain("No invoices yet.");
    expect(html).toContain("No bookings are linked yet");
    expect(html).toContain("No one has signed in to this account.");
  });

  it("is a 404 for no such account, and a load error, not a 404, when the lookup fails", async () => {
    getAdminAccountDetail.mockResolvedValue({ ok: true, data: null });
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    getAdminAccountDetail.mockResolvedValue({ ok: false });
    expect(await render()).toContain("couldn&#x27;t load this customer");
  });

  it("escapes the account name and a member's email", async () => {
    getAdminAccountDetail.mockResolvedValue({
      ok: true,
      data: { ...DETAIL, name: "<img src=x onerror=alert(1)>", members: [{ email: "<script>alert(2)</script>@x.com", role: "owner" }] },
    });
    const html = await render();
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>alert(2)");
  });
});
