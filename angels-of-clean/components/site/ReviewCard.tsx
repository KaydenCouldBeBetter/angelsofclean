import { Quote, Sparkles } from "lucide-react";
import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import type { ReviewContent } from "@/lib/homepage-content";
import { cn } from "@/lib/utils";

/** "Heather W." becomes "HW". Never more than two letters. */
export function initialsOf(author: string): string {
  const letters = author
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}]/gu, "").charAt(0))
    .filter(Boolean);
  return letters.slice(0, 2).join("").toUpperCase();
}

// The quote with the review's highlight (if any) in bold. The words are the
// customer's own: `highlight` has to appear in `quote` word for word, and when it
// doesn't the quote is shown plain.
function QuoteText({ quote, highlight, featured }: { quote: string; highlight?: string; featured: boolean }) {
  const at = highlight ? quote.indexOf(highlight) : -1;
  if (!highlight || at === -1) return <>{quote}</>;
  return (
    <>
      {quote.slice(0, at)}
      <span
        className={cn(
          "font-semibold underline decoration-2 underline-offset-4",
          featured ? "decoration-primary-on-dark" : "text-primary decoration-primary/30",
        )}
      >
        {highlight}
      </span>
      {quote.slice(at + highlight.length)}
    </>
  );
}

// One customer review. A teal accent bar, a quote icon, the quote, then the
// author with an initials avatar. The featured review is a solid teal card.
// Every icon is decoration (aria-hidden); the reader gets the quote and the name.
// The avatar sits beside the figcaption, not inside it, so the caption's text is
// the author's name alone.
export default function ReviewCard({ review }: { review: ReviewContent }) {
  const featured = review.featured === true;
  return (
    <figure
      className={cn(
        "relative grid h-full grid-cols-[auto_1fr] grid-rows-[auto_1fr_auto] items-center gap-x-3 gap-y-4 overflow-hidden rounded-xl p-6 pt-7 md:gap-y-5 md:p-8 md:pt-9",
        "shadow-[0_2px_8px_rgba(0,0,0,0.06)] motion-safe:transition-[transform,box-shadow] motion-safe:duration-200",
        "motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_8px_20px_rgba(0,0,0,0.10)]",
        featured ? "bg-primary text-white" : "bg-white text-ink",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute inset-x-0 top-0 h-1.5", featured ? "bg-primary-on-dark" : "bg-primary")}
      />

      <div className="col-span-2 flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            featured ? "bg-white/15 text-white" : "bg-primary/15 text-primary",
          )}
        >
          <Quote className="size-6 fill-current" />
        </span>
        {review.placeholder ? (
          <PlaceholderBadge />
        ) : (
          <Sparkles aria-hidden="true" className={cn("size-6", featured ? "text-primary-on-dark" : "text-primary/50")} />
        )}
      </div>

      <blockquote className="col-span-2 self-start text-base md:text-lg md:leading-[29px]">
        <p>
          <QuoteText quote={review.quote} highlight={review.highlight} featured={featured} />
        </p>
      </blockquote>

      <span
        aria-hidden="true"
        className={cn(
          "flex size-10 items-center justify-center rounded-full text-sm font-semibold",
          featured ? "bg-white text-primary" : "bg-primary text-white",
        )}
      >
        {initialsOf(review.author)}
      </span>
      <figcaption className={cn("text-sm font-semibold md:text-base", featured ? "text-white" : "text-ink")}>
        {review.author}
      </figcaption>
    </figure>
  );
}
