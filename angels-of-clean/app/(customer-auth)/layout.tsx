import type { Metadata } from "next";
import CustomerAuthShell from "@/components/auth/CustomerAuthShell";

// Sign-in pages show no content worth indexing.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CustomerAuthLayout({ children }: { children: React.ReactNode }) {
  return <CustomerAuthShell>{children}</CustomerAuthShell>;
}
