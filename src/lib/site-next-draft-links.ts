/** `/dev/site-next/` 草案専用（本番トップの `SITE_CATEGORY_LINKS` とは別） */

export type SiteNextDraftCategory = {
  emoji: string;
  title: string;
  href: string;
  mobileTitleLines?: readonly [string, string];
};

/** ハンバーガーメニュー（ワイヤー右列） */
export const SITE_NEXT_DRAWER_LINKS: { title: string; href: string }[] = [
  { title: "催眠音声ビギナーズガイド", href: "/beginner/" },
  { title: "新着記事一覧", href: "/#reviews-heading" },
  { title: "厳選・おすすめ", href: "/?stars=10#reviews-heading" },
  { title: "セール中", href: "/#reviews-heading" },
  { title: "声優別おすすめ作品", href: "/#reviews-heading" },
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
    href: "/#reviews-heading",
  },
  {
    emoji: "🏷️",
    title: "セール中",
    href: "/#reviews-heading",
  },
  {
    emoji: "👑",
    title: "厳選・おすすめ",
    mobileTitleLines: ["厳選・", "おすすめ"],
    href: "/?stars=10#reviews-heading",
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
    href: "/#reviews-heading",
  },
  {
    emoji: "🎤",
    title: "声優別おすすめ作品",
    mobileTitleLines: ["声優別", "おすすめ作品"],
    href: "/#reviews-heading",
  },
];
