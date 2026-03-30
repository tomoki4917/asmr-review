/** 管理人が API 経由で追加した投稿（クライアントは localStorage に保持） */

export const POSTED_REVIEWS_STORAGE_KEY = "asmr-posted-reviews";

export const POST_KINDS = ["review", "author_article", "mechanism"] as const;
export type PostedReviewKind = (typeof POST_KINDS)[number];

export type PostedReview = {
  id: string;
  /** 未保存の旧データはレビューとして扱う */
  postKind?: PostedReviewKind;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  /** レビュー以外は 0 */
  ratingValue: number;
  publishedAt: string;
};

export function effectivePostKind(r: PostedReview): PostedReviewKind {
  const k = r.postKind;
  if (k === "author_article" || k === "mechanism" || k === "review") return k;
  return "review";
}

export function postedKindLabel(kind: PostedReviewKind): string {
  switch (kind) {
    case "author_article":
      return "筆者投稿記事";
    case "mechanism":
      return "催眠音声のメカニズム";
    default:
      return "レビュー";
  }
}

/** 星表示・評価フィルタの対象か */
export function isStarRatedReview(r: PostedReview): boolean {
  return effectivePostKind(r) === "review";
}

/** 1〜5 に丸めた星（レビュー一覧の絞り込み用） */
export function starBucket(rating: number): number {
  return Math.min(5, Math.max(1, Math.round(rating)));
}

function parsePostKindField(raw: unknown): PostedReviewKind {
  if (typeof raw !== "string") return "review";
  return POST_KINDS.includes(raw as PostedReviewKind)
    ? (raw as PostedReviewKind)
    : "review";
}

export function parsePostedReviewsJson(raw: string | null): PostedReview[] {
  if (raw == null || raw === "") return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: PostedReview[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== "string" || !o.id) continue;
      if (typeof o.title !== "string") continue;
      if (typeof o.summary !== "string") continue;
      if (typeof o.body !== "string") continue;
      if (!Array.isArray(o.tags)) continue;
      const tags = o.tags.filter((t): t is string => typeof t === "string");
      const postKind = parsePostKindField(o.postKind);
      let ratingValue = 0;
      if (postKind === "review") {
        if (typeof o.ratingValue !== "number" || Number.isNaN(o.ratingValue)) continue;
        ratingValue = Math.min(5, Math.max(1, Math.round(o.ratingValue)));
      }
      if (typeof o.publishedAt !== "string") continue;
      out.push({
        id: o.id,
        postKind,
        title: o.title,
        summary: o.summary,
        body: o.body,
        tags,
        ratingValue,
        publishedAt: o.publishedAt,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function readPostedReviewsFromStorage(): PostedReview[] {
  if (typeof window === "undefined") return [];
  return parsePostedReviewsJson(
    window.localStorage.getItem(POSTED_REVIEWS_STORAGE_KEY)
  );
}

export function writePostedReviewsToStorage(reviews: PostedReview[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    POSTED_REVIEWS_STORAGE_KEY,
    JSON.stringify(reviews)
  );
}

export function appendPostedReviewToStorage(review: PostedReview): void {
  const prev = readPostedReviewsFromStorage();
  writePostedReviewsToStorage([review, ...prev]);
}
