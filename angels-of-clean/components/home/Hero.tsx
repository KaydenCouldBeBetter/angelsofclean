import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import { HOMEPAGE_TRUST_FACTS } from "@/lib/homepage-content";
import { cn } from "@/lib/utils";

// HeroSplit (Figma 120:3): one headline, one trust strip, exactly two paths.
export default function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="px-4 py-10 md:px-20 md:py-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <h1 id="hero-heading" className="max-w-3xl text-3xl font-bold text-zinc-900 md:text-5xl">
          Professional Home &amp; Office Cleaning in Syracuse, NY
        </h1>

        <ul
          aria-label="Why customers trust us"
          className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-primary/5 p-3 text-sm font-medium text-zinc-900 md:flex-row md:flex-wrap md:gap-x-6"
        >
          {HOMEPAGE_TRUST_FACTS.map((fact) => (
            <li key={fact.id} className="flex flex-wrap items-center gap-2">
              <span>{fact.label}</span>
              {fact.placeholder && <PlaceholderBadge />}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3 md:flex-row md:gap-4">
          <Link
            href="/residential"
            className={cn(buttonVariants(), "h-14 rounded-xl px-6 text-base font-semibold md:min-w-64")}
          >
            Book a cleaning
          </Link>
          <Link
            href="/commercial"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-14 rounded-xl border-zinc-500 px-6 text-base font-semibold text-zinc-700 md:min-w-64",
            )}
          >
            Get a commercial quote
          </Link>
        </div>
      </div>
    </section>
  );
}
