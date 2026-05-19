/** 絞り込みバー（カテゴリボタンからのジャンプ先） */
export const REVIEWS_LIST_FILTERS_ID = "reviews-list-filters";

/** 一覧見出し（`id="reviews-heading"`・後方互換のアンカー） */
export const REVIEWS_LIST_SECTION_ID = "reviews-heading";

export const HOME_REVIEW_LIST_BASE = "/";
export const DEV_SITE_NEXT_LIST_BASE = "/dev/site-next/";

export type ReviewListHrefOptions = {
  sort?: "new" | "old";
  stars?: string;
  /** セール中のみ（`products.json` の `on_sale`） */
  sale?: boolean;
  genre?: "hypnosis" | "doujin";
};

/** トップ／次サイト草案のレビュー一覧へ（クエリ＋`#reviews-heading`） */
export function buildReviewListHref(
  basePath: string,
  options: ReviewListHrefOptions = {}
): string {
  const p = new URLSearchParams();
  if (options.sort === "old") p.set("sort", "old");
  if (options.stars) p.set("stars", options.stars);
  if (options.sale) p.set("sale", "1");
  if (options.genre) p.set("genre", options.genre);
  const prefix = basePath === "/" ? "/" : basePath.replace(/\/?$/, "/");
  const qs = p.toString();
  const hash = `#${REVIEWS_LIST_FILTERS_ID}`;
  return qs ? `${prefix}?${qs}${hash}` : `${prefix}${hash}`;
}
