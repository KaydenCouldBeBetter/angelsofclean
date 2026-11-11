import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminAccountDetail } from "@/lib/supabase/admin-customer-queries";
import { addDaysToDateStr, nyTodayStr } from "@/lib/datetime";
import { DASHBOARD_STATUS } from "../../status-config";
import LoadError from "../../LoadError";
import PlanSection from "./PlanSection";
import InvoiceSection from "./InvoiceSection";
import LinkBookingForm from "./LinkBookingForm";

export const metadata = { title: "Customer" };

// Invoices are due 30 days after they are issued unless the admin changes it.
const DEFAULT_DUE_DAYS = 30;

export default async function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAdminAccountDetail(id);

  if (result.ok && !result.data) notFound();

  const header = (name: string, subtitle: string) => (
    <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8 gap-4">
      <Link href="/admin/customers" className="text-sm font-medium text-primary hover:underline">
        ← Customers
      </Link>
      <div>
        <h1 className="font-semibold text-lg text-[#1c1c1e] leading-tight">{name}</h1>
        <p className="text-xs text-[#5c5c5e]">{subtitle}</p>
      </div>
    </header>
  );

  if (!result.ok) {
    return (
      <>
        {header("Customer", "Account")}
        <LoadError what="this customer" />
      </>
    );
  }

  const account = result.data!;
  const today = nyTodayStr();

  return (
    <>
      {header(account.name, account.type === "commercial" ? "Business account" : "Home account")}

      <div className="flex-1 overflow-auto bg-[#f7f9f8]">
        <div className="p-8 flex flex-col gap-8 max-w-4xl">
          <section aria-labelledby="account" className="bg-white border border-[#e2e8e6] rounded-xl">
            <h2 id="account" className="px-6 py-4 font-semibold text-[17px] text-[#1c1c1e] border-b border-[#e2e8e6]">
              Account
            </h2>
            <dl className="px-6 py-4 flex flex-col gap-2.5">
              <div className="flex">
                <dt className="w-[120px] flex-shrink-0 text-[13px] text-[#5c5c5e]">Created</dt>
                <dd className="text-[13px] font-medium text-[#1c1c1e]">{account.createdLabel}</dd>
              </div>
              {account.phone && (
                <div className="flex">
                  <dt className="w-[120px] flex-shrink-0 text-[13px] text-[#5c5c5e]">Phone</dt>
                  <dd className="text-[13px] font-medium text-[#1c1c1e]">{account.phone}</dd>
                </div>
              )}
              <div className="flex">
                <dt className="w-[120px] flex-shrink-0 text-[13px] text-[#5c5c5e]">
                  {account.members.length === 1 ? "Login" : "Logins"}
                </dt>
                <dd className="text-[13px] font-medium text-[#1c1c1e]">
                  {account.members.length === 0 ? (
                    "No one has signed in to this account."
                  ) : (
                    <ul>
                      {account.members.map((member) => (
                        <li key={member.email}>
                          <a href={`mailto:${member.email}`} className="text-primary hover:underline">
                            {member.email}
                          </a>
                          <span className="font-normal text-[#5c5c5e]">
                            {" "}
                            · {member.role === "owner" ? "Owner" : "Member"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <PlanSection accountId={account.id} accountType={account.type} plans={account.plans} />

          <InvoiceSection
            accountId={account.id}
            invoices={account.invoices}
            visits={account.visits}
            quotes={account.quotes}
            today={today}
            defaultDueOn={addDaysToDateStr(today, DEFAULT_DUE_DAYS)}
          />

          <section aria-labelledby="visits" className="bg-white border border-[#e2e8e6] rounded-xl">
            <h2 id="visits" className="px-6 py-4 font-semibold text-[17px] text-[#1c1c1e] border-b border-[#e2e8e6]">
              Visits
            </h2>
            <div className="px-6 py-4 flex flex-col gap-4">
              {account.visits.length === 0 ? (
                <p className="text-[13px] text-[#5c5c5e]">
                  No bookings are linked yet. A customer&apos;s bookings link automatically by email when they
                  sign in.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {account.visits.map((visit) => (
                    <li key={visit.id} className="flex items-center justify-between gap-4 text-[13px]">
                      <Link href={`/admin/bookings/${visit.id}`} className="text-primary font-medium hover:underline">
                        {visit.ref}
                      </Link>
                      <span className="flex-1 text-[#1c1c1e]">{visit.label}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${DASHBOARD_STATUS[visit.status].chipBg} ${DASHBOARD_STATUS[visit.status].chipText}`}>
                        {DASHBOARD_STATUS[visit.status].label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <LinkBookingForm accountId={account.id} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
