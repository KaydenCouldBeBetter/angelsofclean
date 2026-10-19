import Section from "@/components/home/Section";
import PlaceholderBadge from "@/components/home/PlaceholderBadge";
import { HOMEPAGE_REVIEWS } from "@/lib/homepage-content";

export default function Reviews() {
  return (
    <Section id="reviews" title="What customers say">
      <ul className="grid gap-4 md:grid-cols-3">
        {HOMEPAGE_REVIEWS.map((review) => (
          <li key={review.id}>
            <figure className="flex h-full flex-col gap-3 rounded-xl border border-zinc-200 bg-primary/5 p-4">
              {review.placeholder && <PlaceholderBadge />}
              <blockquote className="text-base text-zinc-900">
                <p>{review.quote}</p>
              </blockquote>
              <figcaption className="mt-auto text-sm text-zinc-600">
                — {review.author}, {review.location}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  );
}
