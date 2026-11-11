import { notFound } from "next/navigation";
import AccountLoadError from "@/components/account/AccountLoadError";
import QuoteList from "@/components/account/QuoteList";
import { buttonVariants } from "@/components/ui/button";
import { getCustomerAccount, getCustomerQuotes } from "@/lib/supabase/customer-queries";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Quotes" };

export default async function QuotesPage() {
  const heading = <h1 className="text-2xl font-bold text-ink">Quotes</h1>;

  const accountResult = await getCustomerAccount();
  if (!accountResult.ok) {
    return (
      <>
        {heading}
        <AccountLoadError what="your account" />
      </>
    );
  }
  // Quote requests are a business feature; a household has no such page.
  if (accountResult.data?.type !== "commercial") notFound();

  const quotesResult = await getCustomerQuotes(accountResult.data.id);
  if (!quotesResult.ok) {
    return (
      <>
        {heading}
        <AccountLoadError what="your quote requests" />
      </>
    );
  }

  return (
    <>
      {heading}
      {quotesResult.data.length === 0 ? (
        <p className="rounded-xl border border-line bg-white p-5 text-sm text-ink-muted">
          No quote requests yet. Requests made with your sign-in email appear here.
        </p>
      ) : (
        <QuoteList quotes={quotesResult.data} />
      )}
      <Link href="/commercial" className={cn(buttonVariants(), "h-11 w-fit px-5 text-sm font-semibold")}>
        Request another quote
      </Link>
    </>
  );
}
