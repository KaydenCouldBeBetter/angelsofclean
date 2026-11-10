import { notFound } from "next/navigation";
import AccountLoadError from "@/components/account/AccountLoadError";
import TeamManager from "@/components/account/TeamManager";
import { createClient } from "@/lib/supabase/server";
import { getCustomerAccount, getTeam } from "@/lib/supabase/customer-queries";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const heading = <h1 className="text-2xl font-bold text-ink">Team</h1>;

  const accountResult = await getCustomerAccount();
  if (!accountResult.ok) {
    return (
      <>
        {heading}
        <AccountLoadError what="your account" />
      </>
    );
  }
  // Only a business owner manages a team; everyone else has no such page.
  const account = accountResult.data;
  if (!account || account.type !== "commercial" || account.role !== "owner") notFound();

  const teamResult = await getTeam(account.id);
  if (!teamResult.ok) {
    return (
      <>
        {heading}
        <AccountLoadError what="your team" />
      </>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims.email === "string" ? data.claims.email : null;

  return (
    <>
      {heading}
      <p className="text-sm text-ink-muted">
        People you invite share this account: they see its visits, quotes and invoices.
      </p>
      <TeamManager members={teamResult.data.members} invites={teamResult.data.invites} currentEmail={email} />
    </>
  );
}
