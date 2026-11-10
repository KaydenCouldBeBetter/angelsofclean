import ReviewCard from "@/components/site/ReviewCard";
import type { ReviewContent } from "@/lib/homepage-content";
import { cn } from "@/lib/utils";

// Customer reviews from lib/homepage-content.ts, one ReviewCard each.
export default function ReviewGrid({ reviews, columns }: { reviews: ReviewContent[]; columns: 3 | 4 }) {
  return (
    <ul
      aria-label="Customer reviews"
      className={cn("grid gap-4 md:grid-cols-2 md:gap-6", columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}
    >
      {reviews.map((review) => (
        <li key={review.id}>
          <ReviewCard review={review} />
        </li>
      ))}
    </ul>
  );
}
