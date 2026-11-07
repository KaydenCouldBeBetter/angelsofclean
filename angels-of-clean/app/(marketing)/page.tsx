import type { Metadata } from "next";
import Hero from "@/components/home/Hero";
import Reviews from "@/components/home/Reviews";
import ServiceAreaTeaser from "@/components/home/ServiceAreaTeaser";
import Services from "@/components/home/Services";
import TrustBadges from "@/components/home/TrustBadges";
import CtaBand from "@/components/site/CtaBand";

export const metadata: Metadata = {
  title: { absolute: "Angels of Clean | Home & Office Cleaning in Syracuse, NY" },
  description:
    "Residential and commercial cleaning in Syracuse, Liverpool, Cicero and across Central New York. AHCA-certified cleaners, in business for 10 years. Request a cleaning online.",
};

// Homepage from Figma "Marketing — Home" (desktop 665:70, mobile 662:70). The
// header and footer come from app/(marketing)/layout.tsx. Photos and any
// unreplaced content come from lib/homepage-content.ts and carry a
// "Placeholder" label until the owner replaces them (backlog B27).
export default function Home() {
  return (
    <>
      <Hero />
      <TrustBadges />
      <Services />
      <Reviews />
      <ServiceAreaTeaser />
      <CtaBand
        id="final-cta-heading"
        title="Ready for a Cleaner Home?"
        body="Request a cleaning online — no account needed. We’ll confirm the time and price with you."
        button={{ label: "Book a cleaning", href: "/residential" }}
        link={{ label: "Commercial? Request a quote", href: "/commercial" }}
      />
    </>
  );
}
