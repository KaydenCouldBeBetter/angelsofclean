import Link from "next/link";
import Band from "@/components/site/Band";
import CtaLink from "@/components/site/CtaLink";
import SectionHeading from "@/components/site/SectionHeading";

// The closing call to action at the foot of a page. "brand" is the teal band
// with a white button; "tint" is the pale band with an outlined one.
export default function CtaBand({
  id,
  tone = "brand",
  title,
  body,
  button,
  link,
}: {
  id: string;
  tone?: "brand" | "tint";
  title: string;
  body?: React.ReactNode;
  button: { label: string; href: string };
  link?: { label: string; href: string };
}) {
  const brand = tone === "brand";
  return (
    <Band tone={brand ? "brand" : "tint"} labelledBy={id}>
      <div className="flex flex-col items-center gap-4 text-center">
        <SectionHeading id={id} tone={brand ? "inverse" : "default"}>
          {title}
        </SectionHeading>
        {body && (
          <p className={brand ? "text-base text-white md:text-lg md:leading-[29px]" : "text-base text-ink-muted md:text-lg md:leading-[29px]"}>
            {body}
          </p>
        )}
        <CtaLink href={button.href} size="band" tone={brand ? "inverse" : "outline"}>
          {button.label}
        </CtaLink>
        {link && (
          <Link href={link.href} className="inline-flex min-h-11 items-center text-sm font-medium text-white underline underline-offset-4">
            {link.label} <span aria-hidden="true">&nbsp;→</span>
          </Link>
        )}
      </div>
    </Band>
  );
}
