import { Suspense } from "react";
import type { Metadata } from "next";
import ResidentialShell from "@/components/booking/ResidentialShell";

export const metadata: Metadata = {
  title: {
    template: "%s | Angels of Clean",
    default: "Book a Cleaning | Angels of Clean",
  },
  description: "Book a residential cleaning service in the greater Syracuse, NY area.",
};

export default function ResidentialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ResidentialShell>
      <Suspense>{children}</Suspense>
    </ResidentialShell>
  );
}
