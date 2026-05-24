/** 記事一覧のカテゴリ絞り込み（`?category=`） */
export type ArticleListCategory = "listening" | "guide" | "recommend";

export const ARTICLE_LIST_CATEGORY_LABELS: Record<
  ArticleListCategory,
  string
> = {
  listening: "視聴環境",
  guide: "解説・用語",
  recommend: "おすすめ",
};

const GUIDE_TAGS = new Set([
  "用語解説",
  "メカニズム",
  "レビュー方法",
  "評価",
  "脳イキ",
  "ドライオーガズム",
  "初心者向け",
  "中級者向け",
]);

export function parseArticleListCategory(
  raw: string | null
): ArticleListCategory | null {
  if (raw === "listening" || raw === "guide" || raw === "recommend") {
    return raw;
  }
  return null;
}

export function articleTagsMatchCategory(
  tags: string[],
  category: ArticleListCategory | null
): boolean {
  if (category == null) return true;
  if (category === "listening") return tags.includes("視聴環境");
  if (category === "recommend") return tags.includes("おすすめ");
  return tags.some((t) => GUIDE_TAGS.has(t)) && !tags.includes("おすすめ");
}
