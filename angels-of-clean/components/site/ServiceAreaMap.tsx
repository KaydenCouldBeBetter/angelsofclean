import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import { SERVICE_AREA_MAP } from "@/lib/homepage-content";
import { cn } from "@/lib/utils";

// The Areas page's "Service Area Map" (Figma 674:167). No map is built yet, so
// it is a labelled pale box with the "Placeholder" label until one is added and
// SERVICE_AREA_MAP.placeholder is set to false (lib/homepage-content.ts).
// Stacked it has a fixed height; from 1024px it is as tall as its parent
// column lets it be (the parent is a flex column), never under 24rem.
export default function ServiceAreaMap({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Service area map"
      className={cn(
        "flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface-tint text-sm font-medium text-ink-muted md:h-96 lg:h-auto lg:min-h-96 lg:flex-1",
        className,
      )}
    >
      <span>Service Area Map</span>
      {SERVICE_AREA_MAP.placeholder && <PlaceholderBadge />}
    </div>
  );
}
