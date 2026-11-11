import Image, { getImageProps } from "next/image";
import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import type { PhotoContent } from "@/lib/homepage-content";
import { cn } from "@/lib/utils";

// A photo from lib/homepage-content.ts. While `src` is null it is a labelled
// pale box (role="img", so a screen reader announces "Team photo" instead of
// skipping it) with the "Placeholder" label on it.
export default function Photo({
  photo,
  label = "Team Photo",
  className,
}: {
  photo: PhotoContent;
  label?: string;
  className?: string;
}) {
  if (photo.src && photo.responsive) {
    // Art direction: a different image per screen size, in one <picture> so the
    // page has one labelled image and the browser downloads only the one it shows.
    const common = { alt: photo.alt, fill: true, sizes: "(min-width: 1024px) 484px, 100vw" } as const;
    const desktop = getImageProps({ ...common, src: photo.responsive.desktop }).props;
    const tablet = getImageProps({ ...common, src: photo.responsive.tablet }).props;
    const { props: phone } = getImageProps({ ...common, src: photo.src });
    return (
      <div className={cn("relative overflow-hidden rounded-xl bg-surface-tint", className)}>
        <picture>
          <source media="(min-width: 1024px)" srcSet={desktop.srcSet} />
          <source media="(min-width: 768px)" srcSet={tablet.srcSet} />
          {/* getImageProps builds the <img> for <picture>; next/image cannot switch sources by breakpoint. */}
          <img {...phone} alt={photo.alt} className={photo.fit === "contain" ? "object-contain" : "object-cover"} />
        </picture>
      </div>
    );
  }
  if (photo.src) {
    return (
      <div className={cn("relative overflow-hidden rounded-xl bg-surface-tint", className)}>
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 1024px) 484px, 100vw"
          className={photo.fit === "contain" ? "object-contain" : "object-cover"}
        />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={photo.alt}
      className={cn("flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-tint text-sm font-medium text-ink-muted md:text-lg", className)}
    >
      <span>{label}</span>
      {photo.placeholder && <PlaceholderBadge />}
    </div>
  );
}
