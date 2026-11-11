import Link from "next/link";
import { getAdminAccounts } from "@/lib/supabase/admin-customer-queries";
import { formatNy } from "@/lib/datetime";
import { formatCents } from "@/lib/money";
import LoadError from "../LoadError";

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage() {
  const accounts = await getAdminAccounts();

  const displayDate = formatNy(new Date(), {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <>
      <header className="flex-shrink-0 h-16 bg-white border-b border-[#e2e8e6] flex items-center px-8 justify-between">
        <div>
          <h1 className="font-semibold text-lg text-[#1c1c1e] leading-tight">Customers</h1>
          <p className="text-xs text-[#5c5c5e]">Customer accounts, plans and invoices</p>
        </div>
        <span className="text-sm text-[#5c5c5e]">{displayDate}</span>
      </header>

      {!accounts.ok ? (
        <LoadError what="customer accounts" />
      ) : (
        <div className="flex-1 overflow-auto bg-[#f7f9f8]">
          <div className="p-8">
            <h2 className="font-semibold text-[17px] text-[#1c1c1e] mb-6">
              {accounts.data.length === 1 ? "1 account" : `${accounts.data.length} accounts`}
              <span className="font-normal text-[13px] text-[#5c5c5e]"> · newest first</span>
            </h2>

            {accounts.data.length === 0 ? (
              <div className="py-16 text-center text-sm text-[#5c5c5e]">
                No customer accounts yet. One is created when a customer signs up and confirms their email.
              </div>
            ) : (
              <div className="bg-white border border-[#e2e8e6] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <caption className="sr-only">Customer accounts</caption>
                  <thead>
                    <tr className="border-b border-[#e2e8e6] text-[#5c5c5e]">
                      <th scope="col" className="px-6 py-3 font-medium">Customer</th>
                      <th scope="col" className="px-4 py-3 font-medium">Type</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Visits</th>
                      <th scope="col" className="px-4 py-3 font-medium text-right">Plans</th>
                      <th scope="col" className="px-6 py-3 font-medium text-right">Balance due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.data.map((account) => (
                      <tr key={account.id} className="border-b border-[#e2e8e6] last:border-0">
                        <th scope="row" className="px-6 py-4 font-normal">
                          <Link
                            href={`/admin/customers/${account.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {account.name}
                          </Link>
                          <p className="text-xs text-[#5c5c5e] mt-0.5">
                            {account.ownerEmail ?? "No owner"}
                            {account.memberCount > 1 && ` · ${account.memberCount} people`}
                          </p>
                        </th>
                        <td className="px-4 py-4 text-[#1c1c1e]">
                          {account.type === "commercial" ? "Business" : "Home"}
                        </td>
                        <td className="px-4 py-4 text-right text-[#1c1c1e]">{account.visitCount}</td>
                        <td className="px-4 py-4 text-right text-[#1c1c1e]">{account.planCount}</td>
                        <td className="px-6 py-4 text-right text-[#1c1c1e]">
                          {account.openInvoiceCount === 0 ? (
                            <span className="text-[#5c5c5e]">None</span>
                          ) : (
                            <>
                              <span className="font-semibold">{formatCents(account.openBalanceCents)}</span>
                              <span className="block text-xs text-[#5c5c5e]">
                                {account.openInvoiceCount} open
                              </span>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
