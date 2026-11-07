import Link from "next/link";
import Band from "@/components/site/Band";
import { SERVICE_AREA_TOWNS } from "@/lib/homepage-content";

// One sentence naming the towns, and a link to the Areas page.
function joinTowns(towns: string[]) {
  return towns.length < 3 ? towns.join(" and ") : `${towns.slice(0, -1).join(", ")}, and ${towns[towns.length - 1]}`;
}

export default function ServiceAreaTeaser() {
  return (
    <Band label="Service area" className="bg-white py-8 md:bg-surface-tint md:py-12">
      <div className="flex flex-col items-center gap-4 text-center md:gap-3">
        <p className="text-base text-ink md:text-lg md:leading-[29px]">
          Serving {joinTowns(SERVICE_AREA_TOWNS.map((t) => t.town))}.
        </p>
        <Link href="/areas" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
          View Service Areas &amp; Coverage<span aria-hidden="true">&nbsp;→</span>
        </Link>
      </div>
    </Band>
  );
}
