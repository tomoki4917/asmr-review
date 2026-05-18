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
    emoji: "👑",
    title: "ランキング",
    href: "/?stars=10#reviews-heading",
    subtitle: "★10・並び替え",
  },
  {
    emoji: "🔍",
    title: "作品一覧",
    href: "/#reviews-heading",
    subtitle: "レビュー一覧へ",
  },
  {
    emoji: "📚",
    title: "知識・コラム",
    href: "/#author-posts-heading",
    subtitle: "解説・用語・記事",
  },
];
