import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CustomerAccount, CustomerQuote, PendingInvite, ServicePlan, TeamMember, Visit } from "@/lib/customer-types";

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
vi.mock("@/app/account/team/actions", () => ({
  createTeamInvite: vi.fn(),
  revokeTeamInvite: vi.fn(),
  removeTeamMember: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getClaims: () => Promise.resolve({ data: { claims: { email: "bob@biz.com" } } }) } }),
}));

type Q<T> = { ok: true; data: T } | { ok: false };
const getCustomerAccount = vi.fn<() => Promise<Q<CustomerAccount | null>>>();
const getCustomerQuotes = vi.fn<(id: string) => Promise<Q<CustomerQuote[]>>>();
const getCustomerVisits = vi.fn<(id: string) => Promise<Q<Visit[]>>>();
const getServicePlans = vi.fn<(id: string) => Promise<Q<ServicePlan[]>>>();
const getTeam = vi.fn<(id: string) => Promise<Q<{ members: TeamMember[]; invites: PendingInvite[] }>>>();
vi.mock("@/lib/supabase/customer-queries", () => ({
  getCustomerAccount: () => getCustomerAccount(),
  getCustomerQuotes: (id: string) => getCustomerQuotes(id),
  getCustomerVisits: (id: string) => getCustomerVisits(id),
  getServicePlans: (id: string) => getServicePlans(id),
  getTeam: (id: string) => getTeam(id),
}));

import QuotesPage from "../quotes/page";
import LocationsPage from "../locations/page";
import TeamPage from "../team/page";

const BUSINESS: CustomerAccount = { id: "acc-1", name: "Bob's Bakery", type: "commercial", role: "owner" };
const QUOTE: CustomerQuote = {
  id: "q1",
  ref: "COM-1007",
  submittedLabel: "November 2, 2026",
  facilityLabel: "Office",
  sqftLabel: "2,000 – 5,000 sq ft",
  frequencyLabel: "Weekly",
  address: "10 Salina St",
  cityLine: "Syracuse, 13202",
};

const render = async (page: () => Promise<React.ReactNode>) => renderToStaticMarkup(await page());

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  getCustomerAccount.mockResolvedValue({ ok: true, data: BUSINESS });
  getCustomerQuotes.mockResolvedValue({ ok: true, data: [QUOTE] });
  getCustomerVisits.mockResolvedValue({ ok: true, data: [] });
  getServicePlans.mockResolvedValue({ ok: true, data: [] });
  getTeam.mockResolvedValue({
    ok: true,
    data: {
      members: [{ userId: "u1", email: "bob@biz.com", role: "owner", joinedLabel: "November 1, 2026" }],
      invites: [],
    },
  });
});

describe("business-only pages", () => {
  const pages: [string, () => Promise<React.ReactNode>][] = [
    ["quotes", QuotesPage],
    ["locations", LocationsPage],
    ["team", TeamPage],
  ];

  it.each(pages)("%s is not found for a household", async (_n, page) => {
    getCustomerAccount.mockResolvedValue({ ok: true, data: { ...BUSINESS, type: "residential" } });
    await expect(render(page)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each(pages)("%s is not found when the login has no account", async (_n, page) => {
    getCustomerAccount.mockResolvedValue({ ok: true, data: null });
    await expect(render(page)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each(pages)("%s says it couldn't load, not that it's empty, when the account lookup fails", async (_n, page) => {
    getCustomerAccount.mockResolvedValue({ ok: false });
    expect(await render(page)).toContain("couldn&#x27;t load");
  });
});

describe("quotes page", () => {
  it("lists the account's requests", async () => {
    const html = await render(QuotesPage);
    expect(html).toContain("COM-1007");
    expect(html).toContain("Office");
    expect(getCustomerQuotes).toHaveBeenCalledWith("acc-1");
  });

  it("explains an empty list and offers another request", async () => {
    getCustomerQuotes.mockResolvedValue({ ok: true, data: [] });
    const html = await render(QuotesPage);
    expect(html).toContain("No quote requests yet");
    expect(html).toContain('href="/commercial"');
  });

  it("shows a load error when quotes fail", async () => {
    getCustomerQuotes.mockResolvedValue({ ok: false });
    expect(await render(QuotesPage)).toContain("couldn&#x27;t load your quote requests");
  });
});

describe("locations page", () => {
  it("shows an empty state with nothing scheduled", async () => {
    expect(await render(LocationsPage)).toContain("No locations yet");
  });

  it("lists addresses from plans", async () => {
    getServicePlans.mockResolvedValue({
      ok: true,
      data: [
        {
          id: "p1",
          serviceLabel: "Commercial cleaning",
          frequencyLabel: "Weekly",
          address: "10 Salina St",
          cityLine: "Syracuse, 13202",
          status: "active",
          statusLabel: "Active",
        },
      ],
    });
    const html = await render(LocationsPage);
    expect(html).toContain("10 Salina St");
    expect(html).toContain("Weekly · Commercial cleaning");
  });
});

describe("team page", () => {
  it("is not found for a member who isn't the owner", async () => {
    getCustomerAccount.mockResolvedValue({ ok: true, data: { ...BUSINESS, role: "member" } });
    await expect(render(TeamPage)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getTeam).not.toHaveBeenCalled();
  });

  it("shows the owner the invite form and team", async () => {
    const html = await render(TeamPage);
    expect(html).toContain("Invite someone");
    expect(html).toContain("bob@biz.com");
    expect(html).toContain("(you)");
  });

  it("shows a load error when the team fails to load", async () => {
    getTeam.mockResolvedValue({ ok: false });
    expect(await render(TeamPage)).toContain("couldn&#x27;t load your team");
  });
});
