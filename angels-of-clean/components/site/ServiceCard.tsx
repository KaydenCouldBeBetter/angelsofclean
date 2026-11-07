import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// One offering: an icon tile, a title (h3), a description and a link. The
// Services page also shows "Custom Quote" (there are no prices, B28).
export default function ServiceCard({
  icon: Icon,
  title,
  description,
  cta,
  customQuote = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  cta: { label: string; href: string };
  customQuote?: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-line bg-white p-6 md:gap-4 md:p-8">
      <div className="flex size-12 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon aria-hidden="true" className="size-6" />
      </div>
      <h3 className="text-xl font-semibold text-ink md:text-[28px] md:leading-9">{title}</h3>
      <p className="text-base text-ink-muted md:text-lg md:leading-[29px]">{description}</p>
      {customQuote && <p className="text-base font-semibold text-primary md:text-lg md:leading-[29px]">Custom Quote</p>}
      <Link href={cta.href} className="mt-auto inline-flex min-h-11 w-fit items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
        {cta.label}
        <span aria-hidden="true">&nbsp;→</span>
      </Link>
    </div>
  );
}
