import { Building2, House, Sparkles } from "lucide-react";
import Band from "@/components/site/Band";
import SectionHeading from "@/components/site/SectionHeading";
import ServiceCard from "@/components/site/ServiceCard";

// Three service highlights (Figma "Service Highlights"). The full list, with
// every offering, is the Services page. No prices: the office confirms the
// price after reviewing each booking (backlog B28).
export default function Services() {
  return (
    <Band labelledBy="services-heading">
      <div className="flex flex-col gap-6 md:gap-8">
        <SectionHeading id="services-heading">Our Services</SectionHeading>
        <div className="grid gap-6 md:grid-cols-3">
          <ServiceCard
            icon={House}
            title="Residential Cleaning"
            description="From routine maintenance to deep cleans, customized to your home. Trained, certified professionals."
            cta={{ label: "See Residential Services", href: "/services#residential" }}
          />
          <ServiceCard
            icon={Building2}
            title="Commercial Cleaning"
            description="Offices, retail spaces, medical facilities and more — with a cleaning plan and schedule built around your business."
            cta={{ label: "Get a Quote", href: "/commercial" }}
          />
          <ServiceCard
            icon={Sparkles}
            title="Specialty Services"
            description="Carpet cleaning, gutter cleaning and window washing. Call, text or ask us for an estimate."
            cta={{ label: "View All Services", href: "/services#specialty" }}
          />
        </div>
      </div>
    </Band>
  );
}
