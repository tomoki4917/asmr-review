import type { Review } from "@/lib/types";

function buildReviewSchema(review: Review, canonicalUrl: string) {
  const best = review.ratingBest ?? 5;
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    name: review.title,
    reviewBody: review.summary,
    datePublished: review.publishedAt,
    url: canonicalUrl,
    author: {
      "@type": "Person",
      name: review.authorName,
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.ratingValue,
      bestRating: best,
      worstRating: 1,
    },
    itemReviewed: {
      "@type": "CreativeWork",
      name: review.itemName,
      description: review.itemDescription ?? review.summary,
    },
  };
}

type Props = {
  review: Review;
  canonicalUrl: string;
};

export function ReviewJsonLd({ review, canonicalUrl }: Props) {
  const json = buildReviewSchema(review, canonicalUrl);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
