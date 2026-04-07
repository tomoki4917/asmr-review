/** フォーム投稿など（クライアントは localStorage に保持） */

export const POSTED_REVIEWS_STORAGE_KEY = "asmr-posted-reviews";

/** 同一タブで一覧を更新するためのカスタムイベント名 */
export const POSTED_REVIEWS_CHANGED_EVENT = "asmr-posted-reviews-changed";

export const POST_KINDS = [
  "review",
  "article",
  "author_article",
  "mechanism",
] as const;
export type PostedReviewKind = (typeof POST_KINDS)[number];

export type PostedReview = {
  id: string;
  /** 未保存の旧データはレビューとして扱う */
  postKind?: PostedReviewKind;
  title: string;
  /** Markdown 可（紹介文）。`![](url)` の URL は http(s) または / で始まるパス */
  summary: string;
  body: string;
  tags: string[];
  /** レビュー以外は 0 */
  ratingValue: number;
  /** 省略時は従来どおり 5 点満点として解釈。新規保存は 10 */
  ratingBest?: number;
  publishedAt: string;
  dlsiteUrl?: string;
  thumbnailUrl?: string;
};

export function effectivePostKind(r: PostedReview): PostedReviewKind {
  const k = r.postKind;
  if (
    k === "article" ||
    k === "author_article" ||
    k === "mechanism" ||
    k === "review"
  ) {
    return k;
  }
  return "review";
}

export function postedKindLabel(kind: PostedReviewKind): string {
  switch (kind) {
    case "article":
      return "記事";
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

/** ローカル投稿の満点（キーなしは従来の 5 点満点） */
export function postedReviewRatingBest(r: PostedReview): number {
  return r.ratingBest ?? 5;
}

function parsePostKindField(raw: unknown): PostedReviewKind {
  if (typeof raw !== "string") return "review";
  return POST_KINDS.includes(raw as PostedReviewKind)
    ? (raw as PostedReviewKind)
    : "review";
}

function optionalUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  return s || undefined;
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
      let ratingBest: number | undefined =
        typeof o.ratingBest === "number" && !Number.isNaN(o.ratingBest)
          ? Math.min(20, Math.max(1, Math.round(o.ratingBest)))
          : undefined;
      let ratingValue = 0;
      if (postKind === "review") {
        if (typeof o.ratingValue !== "number" || Number.isNaN(o.ratingValue)) continue;
        const best = ratingBest ?? 5;
        ratingValue = Math.min(best, Math.max(1, Math.round(o.ratingValue)));
      } else {
        ratingBest = undefined;
      }
      if (typeof o.publishedAt !== "string") continue;
      const row: PostedReview = {
        id: o.id,
        postKind,
        title: o.title,
        summary: o.summary,
        body: o.body,
        tags,
        ratingValue,
        publishedAt: o.publishedAt,
        dlsiteUrl: optionalUrl(o.dlsiteUrl),
        thumbnailUrl: optionalUrl(o.thumbnailUrl),
      };
      if (postKind === "review" && ratingBest != null) {
        row.ratingBest = ratingBest;
      }
      out.push(row);
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

function notifyPostedReviewsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(POSTED_REVIEWS_CHANGED_EVENT));
  }
}

export function appendPostedReviewToStorage(review: PostedReview): void {
  const prev = readPostedReviewsFromStorage();
  writePostedReviewsToStorage([review, ...prev]);
  notifyPostedReviewsChanged();
}

/** 同じ id の投稿を置き換え。見つからなければ false */
export function replacePostedReviewInStorage(review: PostedReview): boolean {
  const prev = readPostedReviewsFromStorage();
  const i = prev.findIndex((r) => r.id === review.id);
  if (i === -1) return false;
  const next = [...prev];
  next[i] = review;
  writePostedReviewsToStorage(next);
  notifyPostedReviewsChanged();
  return true;
}

/** id で削除。見つからなければ false */
export function deletePostedReviewFromStorage(id: string): boolean {
  const prev = readPostedReviewsFromStorage();
  const next = prev.filter((r) => r.id !== id);
  if (next.length === prev.length) return false;
  writePostedReviewsToStorage(next);
  notifyPostedReviewsChanged();
  return true;
}
