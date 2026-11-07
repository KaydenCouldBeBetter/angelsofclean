import Band from "@/components/site/Band";
import ReviewGrid from "@/components/site/ReviewGrid";
import SectionHeading from "@/components/site/SectionHeading";
import { HOMEPAGE_REVIEWS } from "@/lib/homepage-content";

// Three customer reviews. The Areas & Reviews page shows all of them.
export default function Reviews() {
  return (
    <Band tone="tint" labelledBy="reviews-heading">
      <div className="flex flex-col gap-4 md:gap-8">
        <SectionHeading id="reviews-heading">What Our Clients Say</SectionHeading>
        <ReviewGrid reviews={HOMEPAGE_REVIEWS.filter((review) => review.onHomepage)} columns={3} />
      </div>
    </Band>
  );
}
