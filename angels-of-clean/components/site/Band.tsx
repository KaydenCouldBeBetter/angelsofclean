import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Container from "@/components/site/Container";

type Tone = "white" | "tint" | "brand";

const TONE: Record<Tone, string> = {
  white: "bg-white",
  tint: "bg-surface-tint",
  brand: "bg-primary text-white",
};

// A full-width page section. Name it with the id of its heading
// (`labelledBy`) or, when it has no heading, with `label`.
export default function Band({
  tone = "white",
  labelledBy,
  label,
  id,
  className,
  children,
}: {
  tone?: Tone;
  labelledBy?: string;
  label?: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      className={cn("py-12 md:py-20", TONE[tone], className)}
    >
      <Container>{children}</Container>
    </section>
  );
}
