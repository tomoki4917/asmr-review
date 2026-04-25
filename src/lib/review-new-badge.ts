import { reviewPublicationTimeMs } from "@/lib/format-published-at";
import type { Review } from "@/lib/types";

/** 投稿（goLive 開始を含む）から23時間以内に「New」を付ける */
const NEW_PUBLICATION_WINDOW_MS = 23 * 60 * 60 * 1000;

/**
 * レビュー・記事の「公開開始」瞬間（ms）。`goLiveAt` があればその開始、なければ `publishedAt`。
 */
export function getReviewPublicationInstantMs(review: Review): number {
  return reviewPublicationTimeMs(review);
}

export function isReviewNewPublication(review: Review, now: Date): boolean {
  const t = reviewPublicationTimeMs(review);
  if (!Number.isFinite(t) || t === -Infinity) return false;
  if (now.getTime() < t) return false;
  return now.getTime() - t <= NEW_PUBLICATION_WINDOW_MS;
}

/**
 * 互換用。同一 slug が `reviews` にあり、公開から23時間以内なら true（複数件同時に New になり得る）。
 */
export function isNewestMarkdownContent(
  slug: string,
  reviews: Review[]
): boolean {
  const r = reviews.find((x) => x.slug === slug);
  if (!r) return false;
  return isReviewNewPublication(r, new Date());
}
