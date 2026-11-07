import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import type { ReviewContent } from "@/lib/homepage-content";
import { cn } from "@/lib/utils";

// Customer reviews from lib/homepage-content.ts, as white cards.
export default function ReviewGrid({ reviews, columns }: { reviews: ReviewContent[]; columns: 3 | 4 }) {
  return (
    <ul
      aria-label="Customer reviews"
      className={cn("grid gap-4 md:grid-cols-2 md:gap-6", columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}
    >
      {reviews.map((review) => (
        <li key={review.id}>
          <figure className="flex h-full flex-col gap-3 rounded-xl bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] md:gap-4 md:p-8">
            {review.placeholder && <PlaceholderBadge />}
            <blockquote className="text-base text-ink md:text-lg md:leading-[29px]">
              <p>&quot;{review.quote}&quot;</p>
            </blockquote>
            <figcaption className="mt-auto text-sm font-medium text-ink md:text-ink-muted">
              <span aria-hidden="true" className="hidden md:inline">
                —{" "}
              </span>
              {review.author}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
