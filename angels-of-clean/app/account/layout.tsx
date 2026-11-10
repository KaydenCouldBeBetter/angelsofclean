import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: { default: "My account", template: "%s | My account | Angels of Clean" },
  robots: { index: false, follow: false },
};

// Like the admin layout: every account page renders per request, which the
// per-request CSP nonce set in proxy.ts requires, and which keeps one customer's
// page from ever being prerendered or cached for another.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return children;
}
