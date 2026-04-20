import { reviewTitleSingleLine } from "@/lib/review-title";
import type { Review } from "@/lib/types";
import { stripMarkdownForMeta } from "@/lib/strip-markdown-lite";

function buildReviewSchema(review: Review, canonicalUrl: string) {
  const best = review.ratingBest ?? 10;
  const titleOne = reviewTitleSingleLine(review.title);
  const summaryPlain = stripMarkdownForMeta(review.summary) || titleOne;
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    name: titleOne,
    reviewBody: summaryPlain,
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
      "@type": "Product",
      name: review.itemName,
      description: review.itemDescription ?? summaryPlain,
    },
  };
}

type Props = {
  review: Review;
  canonicalUrl: string;
};

export function ReviewJsonLd({ review, canonicalUrl }: Props) {
  if (review.contentKind === "article") return null;
  const json = buildReviewSchema(review, canonicalUrl);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
