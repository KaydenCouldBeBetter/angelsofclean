import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import Section from "@/components/home/Section";
import { COMMERCIAL_FACILITY_TYPES, SERVICE_DESCRIPTIONS, SERVICE_LABELS } from "@/lib/constants";

// Names and descriptions come from lib/constants.ts, the same ones the
// residential flow's first step shows. No prices: the office confirms the price
// after reviewing each booking (backlog B28).
const RESIDENTIAL_SERVICE_IDS = ["standard", "deep", "moveinout"] as const;

export default function Services() {
  const facilities = COMMERCIAL_FACILITY_TYPES.map((f) => f.label.toLowerCase()).join(", ");
  return (
    <Section
      id="services"
      title="Our services"
      intro="Book a home cleaning online in a few minutes. For a business, send a quote request and we'll get back to you."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {RESIDENTIAL_SERVICE_IDS.map((id) => (
          <Card key={id}>
            <CardHeader>
              <h3 className="text-lg font-semibold text-zinc-900">{SERVICE_LABELS[id]}</h3>
              <CardDescription className="text-base text-zinc-600">{SERVICE_DESCRIPTIONS[id]}</CardDescription>
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
