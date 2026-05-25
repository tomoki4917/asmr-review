/** `/dev/site-next/` 草案専用（本番トップの `SITE_CATEGORY_LINKS` とは別） */

import {
  buildReviewListHref,
  DEV_SITE_NEXT_LIST_BASE,
  FEATURED_PICKS_HUB_PATH,
  KNOWLEDGE_COLUMNS_HUB_PATH,
  VOICE_ACTORS_HUB_PATH,
  WORKS_LIST_HUB_PATH,
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
    title: "作品を探す",
    href: WORKS_LIST_HUB_PATH,
  },
  {
    title: "厳選・おすすめ",
    href: FEATURED_PICKS_HUB_PATH,
  },
  {
    title: "セール中",
    href: buildReviewListHref(WORKS_LIST_HUB_PATH, { sale: true }),
  },
  {
    title: "声優から作品を探す",
    href: VOICE_ACTORS_HUB_PATH,
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
    emoji: "🔍",
    title: "作品を探す",
    mobileTitleLines: ["作品を", "探す"],
    href: WORKS_LIST_HUB_PATH,
  },
  {
    emoji: "🏷️",
    title: "セール中",
    href: buildReviewListHref(WORKS_LIST_HUB_PATH, { sale: true }),
  },
  {
    emoji: "👑",
    title: "厳選・おすすめ",
    mobileTitleLines: ["厳選・", "おすすめ"],
    href: FEATURED_PICKS_HUB_PATH,
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
    href: KNOWLEDGE_COLUMNS_HUB_PATH,
  },
  {
    emoji: "⭕",
    title: "サークル紹介",
    mobileTitleLines: ["サークル", "紹介"],
    href: buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { sort: "new" }),
  },
  {
    emoji: "🎤",
    title: "声優から作品を探す",
    mobileTitleLines: ["声優から", "作品を探す"],
    href: VOICE_ACTORS_HUB_PATH,
  },
];
