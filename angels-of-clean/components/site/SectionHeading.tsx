import { cn } from "@/lib/utils";

// A section's h2 (or the page's h1) and the paragraph under it.
export default function SectionHeading({
  id,
  as: Tag = "h2",
  size = "lg",
  align = "center",
  tone = "default",
  intro,
  children,
}: {
  id: string;
  as?: "h1" | "h2";
  size?: "lg" | "md";
  align?: "center" | "left";
  tone?: "default" | "inverse";
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-4", align === "center" ? "items-center text-center" : "items-start text-left")}>
      <Tag
        id={id}
        className={cn(
          "font-semibold",
          size === "lg" ? "text-2xl md:text-[40px] md:leading-12" : "text-xl md:text-[28px] md:leading-9",
          tone === "inverse" ? "text-white" : "text-ink",
        )}
      >
        {children}
      </Tag>
      {intro && <p className="text-base text-ink-muted md:text-lg md:leading-[29px]">{intro}</p>}
    </div>
  );
}
