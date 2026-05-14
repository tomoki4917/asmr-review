import type { Review } from "./types";

const GO_LIVE_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** `reviews.ts` の `goLiveStartMs` と同じ基準（クライアントでも使える） */
function goLiveStartMsForPublication(goLiveAt: string): number {
  const s = goLiveAt.trim();
  if (GO_LIVE_DATE_ONLY.test(s)) {
    return Date.parse(`${s}T00:00:00.000Z`);
  }
  return Date.parse(s);
}

/** 並び替え・「新着」判定用。`goLiveAt` があればその開始瞬間、なければ `publishedAt`。 */
export function reviewPublicationTimeMs(
  review: Pick<Review, "publishedAt" | "goLiveAt">
): number {
  if (review.goLiveAt?.trim()) {
    const start = goLiveStartMsForPublication(review.goLiveAt.trim());
    if (!Number.isNaN(start)) return start;
  }
  const t = Date.parse(review.publishedAt);
  return Number.isNaN(t) ? -Infinity : t;
}

/** 一覧カード用。`YYYY-MM-DD` を `2026/4/9` 形式に */
export function formatPublishedAtForList(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso.trim();
  return `${Number(m[1])}/${Number(m[2])}/${Number(m[3])}`;
}

/**
 * 一覧・詳細の「投稿」表示用の暦日（YYYY-MM-DD）。
 * `goLiveAt` があるときは予約公開日（日本の暦日）に揃える。
 */
export function effectiveDisplayPublishedIsoDate(
  publishedAt: string,
  goLiveAt?: string | null
): string {
  const pub = publishedAt.trim();
  const g = goLiveAt?.trim();
  if (!g) {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(pub);
    return m ? m[1]! : pub;
  }
  if (GO_LIVE_DATE_ONLY.test(g)) return g;
  const ms = Date.parse(g);
  if (Number.isNaN(ms)) {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(pub);
    return m ? m[1]! : pub;
  }
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

export function formatReviewPublishedForList(
  review: Pick<Review, "publishedAt" | "goLiveAt">
): string {
  return formatPublishedAtForList(
    effectiveDisplayPublishedIsoDate(review.publishedAt, review.goLiveAt)
  );
}

/**
 * 作品販売日（`YYYY-MM-DD`）を日本語表記に（暦のズレを避け文字列から組み立て）
 */
export function formatSaleDateJapanese(isoDate: string): string {
  const s = isoDate.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}

/**
 * OGP 等用の公開日時（ISO 8601）。`goLiveAt` 優先。
 * 日付のみの `goLiveAt` は `reviews.ts` の公開開始と同じ UTC 0 時を付与する。
 */
export function articlePublishedTimeIso(
  review: Pick<Review, "publishedAt" | "goLiveAt">
): string {
  const g = review.goLiveAt?.trim();
  if (g) {
    if (GO_LIVE_DATE_ONLY.test(g)) return `${g}T00:00:00.000Z`;
    return g;
  }
  const p = review.publishedAt.trim();
  if (p.includes("T")) return p;
  if (GO_LIVE_DATE_ONLY.test(p)) return `${p}T12:00:00+09:00`;
  return p;
}
