import type { DlsiteProductRecord } from "@/lib/dlsite-product-catalog";
import { reviewTitleSingleLine } from "@/lib/review-title";
import type { Review } from "@/lib/types";
import { stripMarkdownForMeta } from "@/lib/strip-markdown-lite";

/**
 * Google は `Product` に対して `offers`・`review`・`aggregateRating` のいずれか必須。
 * DLsite 価格が取れていれば `offers`、それ以外は当レビュー星に合わせた `aggregateRating` を付与する。
 */
function buildItemReviewed(
  review: Review,
  summaryPlain: string,
  dlsiteProduct: DlsiteProductRecord | undefined
): Record<string, unknown> {
  const best = review.ratingBest ?? 10;
  const product: Record<string, unknown> = {
    "@type": "Product",
    name: review.itemName,
    description: review.itemDescription ?? summaryPlain,
  };

  if (typeof review.coverImage === "string" && /^https?:\/\//i.test(review.coverImage)) {
    product.image = review.coverImage;
  }

  if (dlsiteProduct && dlsiteProduct.current_price > 0) {
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      url: dlsiteProduct.url,
      price: dlsiteProduct.current_price,
      priceCurrency: "JPY",
      availability: "https://schema.org/InStock",
    };
    if (dlsiteProduct.sale_end_iso?.trim()) {
      offer.priceValidUntil = dlsiteProduct.sale_end_iso.trim();
    }
    product.offers = offer;
    return product;
  }

  product.aggregateRating = {
    "@type": "AggregateRating",
    ratingValue: review.ratingValue,
    bestRating: best,
    worstRating: 1,
    ratingCount: 1,
  };
  return product;
}

function buildReviewSchema(
  review: Review,
  canonicalUrl: string,
  dlsiteProduct: DlsiteProductRecord | undefined
) {
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
    itemReviewed: buildItemReviewed(review, summaryPlain, dlsiteProduct),
  };
}

type Props = {
  review: Review;
  canonicalUrl: string;
  /** あれば `Product.offers` に反映（税込・`products.json`） */
  dlsiteProduct?: DlsiteProductRecord;
};

export function ReviewJsonLd({ review, canonicalUrl, dlsiteProduct }: Props) {
  if (review.contentKind === "article") return null;
  const json = buildReviewSchema(review, canonicalUrl, dlsiteProduct);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
