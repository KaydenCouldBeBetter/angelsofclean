import { Suspense } from "react";
import type { Metadata } from "next";

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
    <div className="flex flex-col min-h-screen bg-white max-w-sm mx-auto">
      <Suspense>{children}</Suspense>
    </div>
  );
}
