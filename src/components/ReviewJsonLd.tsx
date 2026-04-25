import type { DlsiteProductRecord } from "@/lib/dlsite-product-catalog";
import { reviewTitleSingleLine } from "@/lib/review-title";
import { effectiveDisplayPublishedIsoDate } from "@/lib/format-published-at";
import type { Review } from "@/lib/types";
import { stripMarkdownForMeta } from "@/lib/strip-markdown-lite";

function productAndReviewIds(canonicalUrl: string) {
  const base = canonicalUrl.replace(/#.*$/, "");
  return { productId: `${base}#product`, reviewId: `${base}#review` };
}

/**
 * Google の商品スニペット用 `Product` は、`offers`・`review`・`aggregateRating` のいずれか必須。
 * ネストだけの `Review` → `Product` だと `Product` ノードに `review` が無いと警告になるため、
 * `@graph` で `Product` に `review`（同一ページの `Review` への `@id`）を明示し、
 * 価格が取れているときは `offers` も併記、`aggregateRating` は常に付与する。
 */
function buildGraphSchema(
  review: Review,
  canonicalUrl: string,
  dlsiteProduct: DlsiteProductRecord | undefined
) {
  const best = review.ratingBest ?? 10;
  const titleOne = reviewTitleSingleLine(review.title);
  const summaryPlain = stripMarkdownForMeta(review.summary) || titleOne;
  const { productId, reviewId } = productAndReviewIds(canonicalUrl);

  const aggregateRating = {
    "@type": "AggregateRating",
    ratingValue: review.ratingValue,
    bestRating: best,
    worstRating: 1,
    ratingCount: 1,
  };

  const product: Record<string, unknown> = {
    "@type": "Product",
    "@id": productId,
    name: review.itemName,
    description: review.itemDescription ?? summaryPlain,
    review: { "@id": reviewId },
    aggregateRating,
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
  }

  const reviewNode: Record<string, unknown> = {
    "@type": "Review",
    "@id": reviewId,
    name: titleOne,
    reviewBody: summaryPlain,
    datePublished: effectiveDisplayPublishedIsoDate(
      review.publishedAt,
      review.goLiveAt
    ),
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
    itemReviewed: { "@id": productId },
  };

  return {
    "@context": "https://schema.org",
    "@graph": [reviewNode, product],
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
  const json = buildGraphSchema(review, canonicalUrl, dlsiteProduct);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
