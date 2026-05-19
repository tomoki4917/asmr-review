import { buildReviewListHref, HOME_REVIEW_LIST_BASE } from "@/lib/review-list-href";

/** トップ／次サイト草案のカテゴリナビ */
export type SiteCategoryLink = {
  emoji: string;
  title: string;
  href: string;
  subtitle: string;
  /** モバイル3列グリッド：ラベルをこの2行で中央表示（他カテゴリと同じ縦並び） */
  mobileTitleLines?: readonly [string, string];
};

export const SITE_CATEGORY_LINKS: SiteCategoryLink[] = [
  {
    emoji: "🔰",
    title: "催眠音声ビギナーズガイド",
    mobileTitleLines: ["催眠音声", "ビギナーズガイド"],
    href: "/beginner/",
    subtitle: "導線（ルート切替）",
  },
  {
    emoji: "📰",
    title: "新着記事一覧",
    mobileTitleLines: ["新着記事", "一覧"],
    href: buildReviewListHref(HOME_REVIEW_LIST_BASE, { sort: "new" }),
    subtitle: "新しい順",
  },
  {
    emoji: "🏷️",
    title: "セール中",
    href: buildReviewListHref(HOME_REVIEW_LIST_BASE, { sale: true }),
    subtitle: "値下げ中の作品",
  },
  {
    emoji: "👑",
    title: "ランキング",
    href: buildReviewListHref(HOME_REVIEW_LIST_BASE, { stars: "10" }),
    subtitle: "★10・並び替え",
  },
  {
    emoji: "🔍",
    title: "作品一覧",
    href: buildReviewListHref(HOME_REVIEW_LIST_BASE, { sort: "new" }),
    subtitle: "レビュー一覧へ",
  },
  {
    emoji: "🎧",
    title: "視聴環境",
    href: "/listening-environment/",
    subtitle: "部屋・イヤホン・記事一覧",
  },
  {
    emoji: "📚",
    title: "知識・コラム",
    href: "/#author-posts-heading",
    subtitle: "解説・用語・記事",
  },
];
