import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The marketing site's call-to-action links. Every one of them goes to one of
// two booking paths (/residential or /commercial), or to the Areas page's
// contact section for an estimate.
type Tone = "primary" | "outline" | "inverse";
type Size = "nav" | "hero" | "band";

const SIZE: Record<Size, string> = {
  nav: "h-11 rounded-xl px-6 text-sm font-semibold",
  hero: "h-14 w-full rounded-xl px-8 text-base font-semibold md:h-12 md:w-auto",
  band: "h-14 w-full rounded-xl px-8 text-base font-semibold md:h-12 md:w-55 md:text-sm",
};

const TONE: Record<Tone, string> = {
  primary: "",
  // Figma outlines this one in coral (#fc6367, 2.95:1 on white, under the 3:1
  // WCAG 2.2 AA needs for a button edge), so it takes the same grey the old
  // homepage used (4.8:1).
  outline: "border-2 border-zinc-500 bg-white text-ink hover:bg-zinc-100",
  inverse: "bg-white text-primary hover:bg-zinc-100",
};

export default function CtaLink({
  href,
  tone = "primary",
  size = "hero",
  className,
  children,
}: {
  href: string;
  tone?: Tone;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: tone === "outline" ? "outline" : "default" }), SIZE[size], TONE[tone], className)}
    >
      {children}
    </Link>
  );
}
