import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import { SERVICE_AREA_MAP } from "@/lib/homepage-content";

// The Areas page's "Service Area Map" (Figma 674:167). No map is built yet, so
// it is a labelled pale box with the "Placeholder" label until one is added and
// SERVICE_AREA_MAP.placeholder is set to false (lib/homepage-content.ts).
export default function ServiceAreaMap() {
  return (
    <div
      role="img"
      aria-label="Service area map"
      className="flex h-50 flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface-tint text-sm font-medium text-ink-muted md:h-75"
    >
      <span>Service Area Map</span>
      {SERVICE_AREA_MAP.placeholder && <PlaceholderBadge />}
    </div>
  );
}
