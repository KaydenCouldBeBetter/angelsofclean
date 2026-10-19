import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import Section from "@/components/home/Section";
import { COMMERCIAL_FACILITY_TYPES, SERVICE_LABELS } from "@/lib/constants";

// Descriptions match the residential flow's first step. No prices: the office
// confirms the price after reviewing each booking (backlog B28).
const RESIDENTIAL_SERVICES = [
  {
    id: "standard" as const,
    description:
      "Regular maintenance cleaning for your home. Includes dusting, vacuuming, mopping, and surface sanitizing.",
  },
  {
    id: "deep" as const,
    description:
      "Thorough top-to-bottom cleaning. Includes baseboards, inside appliances, and detailed scrubbing.",
  },
  {
    id: "moveinout" as const,
    description: "Complete property turnover clean. Every surface, every room, move-in ready.",
  },
];

export default function Services() {
  const facilities = COMMERCIAL_FACILITY_TYPES.map((f) => f.label.toLowerCase()).join(", ");
  return (
    <Section
      id="services"
      title="Our services"
      intro="Book a home cleaning online in a few minutes. For a business, send a quote request and we'll get back to you."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {RESIDENTIAL_SERVICES.map((service) => (
          <Card key={service.id}>
            <CardHeader>
              <h3 className="text-lg font-semibold text-zinc-900">{SERVICE_LABELS[service.id]}</h3>
              <CardDescription className="text-base text-zinc-600">{service.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-zinc-900">Commercial cleaning</h3>
          <p className="text-base text-zinc-600">
            Cleaning for your business: {facilities} and more. Tell us about your space and
            we&apos;ll send a quote.
          </p>
        </CardContent>
      </Card>
    </Section>
  );
}
