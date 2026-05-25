import { reviewTitleSingleLine } from "@/lib/review-title";
import { parseVoiceActorLine } from "@/lib/review-voice-actors";
import type { PostedReview } from "@/lib/posted-review";
import type { Review } from "@/lib/types";

export type MergedReviewSearchItem =
  | { kind: "file"; review: Review }
  | { kind: "local"; review: PostedReview };

/** URL の `q` を正規化（前後空白除去） */
export function normalizeReviewListSearchQuery(raw: string | null | undefined): string {
  if (raw == null) return "";
  return raw.trim();
}

function fileReviewSearchHaystack(review: Review): string {
  const voice = parseVoiceActorLine(review.body) ?? "";
  return [
    reviewTitleSingleLine(review.title),
    review.itemName,
    review.circleName ?? "",
    review.slug,
    review.summary,
    voice,
    ...review.tags,
  ]
    .filter(Boolean)
    .join("\n");
}

function postedReviewSearchHaystack(review: PostedReview): string {
  const voice = parseVoiceActorLine(review.body) ?? "";
  return [review.title, review.summary, voice, ...review.tags]
    .filter(Boolean)
    .join("\n");
}

export function mergedReviewSearchHaystack(item: MergedReviewSearchItem): string {
  return item.kind === "file"
    ? fileReviewSearchHaystack(item.review)
    : postedReviewSearchHaystack(item.review);
}

/** 部分一致（大文字小文字は無視。日本語はそのまま） */
export function mergedReviewMatchesSearchQuery(
  item: MergedReviewSearchItem,
  rawQuery: string
): boolean {
  const q = normalizeReviewListSearchQuery(rawQuery);
  if (!q) return true;
  const hay = mergedReviewSearchHaystack(item).toLowerCase();
  return hay.includes(q.toLowerCase());
}
