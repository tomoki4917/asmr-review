/** `/dev/site-next/` 草案専用（本番トップの `SITE_CATEGORY_LINKS` とは別） */

import {
  buildReviewListHref,
  DEV_SITE_NEXT_LIST_BASE,
} from "@/lib/review-list-href";

export type SiteNextDraftCategory = {
  emoji: string;
  title: string;
  href: string;
  mobileTitleLines?: readonly [string, string];
};

/** ハンバーガーメニュー（ワイヤー右列） */
export const SITE_NEXT_DRAWER_LINKS: { title: string; href: string }[] = [
  { title: "催眠音声ビギナーズガイド", href: "/beginner/" },
  {
    title: "新着記事一覧",
    href: buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { sort: "new" }),
  },
  {
    title: "厳選・おすすめ",
    href: buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { stars: "10" }),
  },
  {
    title: "セール中",
    href: buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { sale: true }),
  },
  {
    title: "声優別おすすめ作品",
    href: buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { sort: "new" }),
  },
];

/** 3×3 カテゴリグリッド（ワイヤー中央） */
export const SITE_NEXT_CATEGORY_GRID: SiteNextDraftCategory[] = [
  {
    emoji: "🔰",
    title: "催眠音声ビギナーズガイド",
    mobileTitleLines: ["催眠音声", "ビギナーズガイド"],
    href: "/beginner/",
  },
  {
    emoji: "📰",
    title: "新着記事一覧",
    mobileTitleLines: ["新着記事", "一覧"],
    href: buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { sort: "new" }),
  },
  {
    emoji: "🏷️",
    title: "セール中",
    href: buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { sale: true }),
  },
  {
    emoji: "👑",
    title: "厳選・おすすめ",
    mobileTitleLines: ["厳選・", "おすすめ"],
    href: buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { stars: "10" }),
  },
  {
    emoji: "🎧",
    title: "視聴環境",
    href: "/listening-environment/",
  },
  {
    emoji: "🎚️",
    title: "視聴機材",
    href: "/reviews/listening-environment-room-setup/",
  },
  {
    emoji: "📚",
    title: "知識・コラム",
    mobileTitleLines: ["知識・", "コラム"],
    href: "/#author-posts-heading",
  },
  {
    emoji: "⭕",
    title: "サークル紹介",
    mobileTitleLines: ["サークル", "紹介"],
    href: buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { sort: "new" }),
  },
  {
    emoji: "🎤",
    title: "声優別おすすめ作品",
    mobileTitleLines: ["声優別", "おすすめ作品"],
    href: buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { sort: "new" }),
  },
];
