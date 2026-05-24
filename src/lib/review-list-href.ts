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
  /** 声優名（`index.md` の声優行・部分一致） */
  voice?: string;
  /** 声優ハブの系統（`ama` / `ds` / `dm`） */
  tone?: "ama" | "ds" | "dm";
  /** 記事一覧のカテゴリ（`listening` / `guide` / `recommend`） */
  category?: "listening" | "guide" | "recommend";
};

/** 声優別おすすめハブ（次サイトグリッド・メニューから） */
export const VOICE_ACTORS_HUB_PATH = "/voice-actors/";

/** 厳選・おすすめハブ（次サイトグリッド・メニューから） */
export const FEATURED_PICKS_HUB_PATH = "/featured/";

/** 記事一覧ハブ（`/articles/`） */
export const ARTICLES_LIST_HUB_PATH = "/articles/";

/** 知識・コラムハブ（解説シリーズ） */
export const KNOWLEDGE_COLUMNS_HUB_PATH = "/knowledge/";

/** 作品一覧ハブ（レビュー絞り込み一覧） */
export const WORKS_LIST_HUB_PATH = "/works/";

/** @deprecated `VOICE_ACTORS_HUB_PATH` へリダイレクト */
export const DEV_SITE_NEXT_VOICE_ACTORS_PATH = "/dev/site-next/voice-actors/";

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
  if (options.voice) p.set("voice", options.voice);
  if (options.tone) p.set("tone", options.tone);
  if (options.category) p.set("category", options.category);
  const prefix = basePath === "/" ? "/" : basePath.replace(/\/?$/, "/");
  const qs = p.toString();
  const hash = `#${REVIEWS_LIST_FILTERS_ID}`;
  return qs ? `${prefix}?${qs}${hash}` : `${prefix}${hash}`;
}
