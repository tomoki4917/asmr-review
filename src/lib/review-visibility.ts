import type { Review } from "./types";

const GO_LIVE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `goLiveAt` の開始瞬間（ms）。`YYYY-MM-DD` のときは UTC 0:00 開始。 */
export function goLiveStartMs(goLiveAt: string): number {
  const s = goLiveAt.trim();
  if (GO_LIVE_DATE_RE.test(s)) {
    return Date.parse(`${s}T00:00:00.000Z`);
  }
  return Date.parse(s);
}

/** 現在時刻が goLiveAt 以降なら true（未指定なら常に true） */
export function isReviewVisibleByGoLiveAt(review: Review, now: Date): boolean {
  if (!review.goLiveAt?.trim()) return true;
  const start = goLiveStartMs(review.goLiveAt.trim());
  if (Number.isNaN(start)) return true;
  return now.getTime() >= start;
}

/**
 * 執筆者プレビュー（`npm run dev` / `start` / `REVIEW_PREVIEW_SERVER`）。
 * 本番の静的 `out` ビルドでは false。
 */
export function isOwnerPreviewServer(): boolean {
  const forceShowAll =
    process.env.REVIEW_IGNORE_GO_LIVE === "1" ||
    process.env.REVIEW_IGNORE_GO_LIVE === "true";
  if (forceShowAll) return true;

  const respectGoLive =
    process.env.REVIEW_RESPECT_GO_LIVE === "1" ||
    process.env.REVIEW_RESPECT_GO_LIVE === "true";
  if (respectGoLive) return false;

  if (process.env.NODE_ENV === "development") return true;
  const ev = process.env.npm_lifecycle_event;
  if (ev === "dev" || ev === "start") return true;
  if (
    process.env.REVIEW_PREVIEW_SERVER === "1" ||
    process.env.REVIEW_PREVIEW_SERVER === "true"
  ) {
    return true;
  }
  return false;
}

/** 投稿日未定・一覧除外の内部下書き */
export function isOwnerDraftReview(
  review: Pick<Review, "publishedAt" | "excludeFromReviewIndex">
): boolean {
  return (
    review.excludeFromReviewIndex === true || !review.publishedAt?.trim()
  );
}

/**
 * 一覧・サイトマップ・本文公開可否。`applyGoLiveFilter` と同じルール。
 *
 * - `REVIEW_IGNORE_GO_LIVE` … 常に公開扱い。
 * - `REVIEW_RESPECT_GO_LIVE` … dev / `next start` でも goLive を厳密に適用。
 * - それ以外で **`npm run dev` / `npm run start`** や **`NODE_ENV===development`**
 *   のときは goLive 前・下書きも表示（静的 `out` ビルド時は除外）。
 */
export function isReviewVisibleOnSite(review: Review, now: Date): boolean {
  if (isOwnerPreviewServer()) return true;

  // 本番: 一覧除外・投稿日未定は本文も出さない（URL 直打ちでもプレースホルダ）
  if (review.excludeFromReviewIndex === true) return false;
  if (!review.publishedAt?.trim()) return false;

  return isReviewVisibleByGoLiveAt(review, now);
}
