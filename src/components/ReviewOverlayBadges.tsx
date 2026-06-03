import {
  getDlsiteProductById,
  isDlsiteProductShinsaku,
} from "@/lib/dlsite-product-catalog";
import { getDlsiteRankingBadgesForProduct } from "@/lib/dlsite-ranking-catalog";
import type { Review } from "@/lib/types";
import { DlsiteRankingBadges } from "./DlsiteRankingBadge";
import { ReviewNewBadge } from "./ReviewNewBadge";
import { ReviewPreparingBadge } from "./ReviewPreparingBadge";
import { ShinsakuBadge } from "./ShinsakuBadge";

type Props = {
  review: Pick<Review, "dlsiteProductId">;
  showNew?: boolean;
  preparing?: boolean;
};

/** カード表紙右上（NEW・新作・DLsite順位・予約） */
export function ReviewOverlayBadges({
  review,
  showNew = false,
  preparing = false,
}: Props) {
  const now = new Date();
  const dlsiteProduct =
    review.dlsiteProductId != null
      ? getDlsiteProductById(review.dlsiteProductId)
      : undefined;
  const showShinsaku = isDlsiteProductShinsaku(dlsiteProduct, now);
  const rankingEntries = getDlsiteRankingBadgesForProduct(
    review.dlsiteProductId
  );

  const hasStatusBadges = preparing || showNew || showShinsaku;
  const hasRanking = rankingEntries.length > 0;

  if (!hasStatusBadges && !hasRanking) {
    return null;
  }

  return (
    <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-1">
      {hasStatusBadges ? (
        <div className="flex flex-wrap justify-end gap-1.5">
          {preparing ? <ReviewPreparingBadge variant="overlay" /> : null}
          {showNew ? <ReviewNewBadge variant="overlay" /> : null}
          {showShinsaku ? <ShinsakuBadge variant="overlay" /> : null}
        </div>
      ) : null}
      {hasRanking ? (
        <DlsiteRankingBadges variant="overlay" entries={rankingEntries} />
      ) : null}
    </div>
  );
}
