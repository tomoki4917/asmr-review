import {
  buildReviewListHref,
  FEATURED_PICKS_HUB_PATH,
  HOME_REVIEW_LIST_BASE,
  KNOWLEDGE_COLUMNS_HUB_PATH,
  VOICE_ACTORS_HUB_PATH,
  WORKS_LIST_HUB_PATH,
} from "@/lib/review-list-href";

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
    emoji: "🔍",
    title: "作品を探す",
    mobileTitleLines: ["作品を", "探す"],
    href: WORKS_LIST_HUB_PATH,
    subtitle: "レビュー一覧へ",
  },
  {
    emoji: "🏷️",
    title: "セール中",
    href: buildReviewListHref(WORKS_LIST_HUB_PATH, { sale: true }),
    subtitle: "値下げ中の作品",
  },
  {
    emoji: "👑",
    title: "厳選・おすすめ",
    mobileTitleLines: ["厳選・", "おすすめ"],
    href: FEATURED_PICKS_HUB_PATH,
    subtitle: "編集部おすすめ記事",
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
    href: KNOWLEDGE_COLUMNS_HUB_PATH,
    subtitle: "解説・用語・記事",
  },
  {
    emoji: "🎤",
    title: "声優から作品を探す",
    mobileTitleLines: ["声優から", "作品を探す"],
    href: VOICE_ACTORS_HUB_PATH,
    subtitle: "声優名・系統から探す",
  },
];
