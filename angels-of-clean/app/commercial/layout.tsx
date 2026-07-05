import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Angels of Clean",
    default: "Get a Quote | Angels of Clean",
  },
  description: "Request a commercial cleaning quote in the greater Syracuse, NY area.",
};

export default function CommercialLayout({
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
