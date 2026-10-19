import Section from "@/components/home/Section";
import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import { HOMEPAGE_TRUST_FACTS } from "@/lib/homepage-content";

export default function TrustFacts() {
  return (
    <Section id="trust" title="Why customers choose us">
      <ul className="grid gap-4 md:grid-cols-3">
        {HOMEPAGE_TRUST_FACTS.map((fact) => (
          <li key={fact.id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4">
            {fact.placeholder && <PlaceholderBadge />}
            <h3 className="text-lg font-semibold text-zinc-900">{fact.label}</h3>
            {fact.detail && <p className="text-base text-zinc-600">{fact.detail}</p>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
