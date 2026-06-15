import { reviewPublicationTimeMs } from "@/lib/format-published-at";
import { RATING_BEST_DEFAULT, isStarBucketNineOrAbove } from "@/lib/rating-scale";
import type { Review } from "@/lib/types";

/** 全年齢トップ・YouTube 案内のピックアップ固定 slug（`null` で ★9 以上・新しい順） */
export const ALL_AGES_SPOTLIGHT_SLUG: string | null =
  "saimin-school-hypnosis-training";

export function pickAllAgesSpotlight(reviews: Review[]): Review | undefined {
  if (ALL_AGES_SPOTLIGHT_SLUG) {
    return reviews.find((r) => r.slug === ALL_AGES_SPOTLIGHT_SLUG);
  }
  return reviews
    .filter((r) => r.contentKind === "review")
    .filter((r) =>
      isStarBucketNineOrAbove(r.ratingValue, r.ratingBest ?? RATING_BEST_DEFAULT)
    )
    .sort((a, b) => reviewPublicationTimeMs(b) - reviewPublicationTimeMs(a))[0];
}
