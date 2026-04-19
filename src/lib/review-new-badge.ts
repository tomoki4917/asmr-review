import type { Review } from "@/lib/types";

function publishedTime(r: Review): number {
  const t = Date.parse(r.publishedAt);
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * リポジトリ内 Markdown（レビュー・記事）のうち、投稿日が最も新しい slug を1件だけ返す。
 * 同日内の並びは slug で安定化。
 */
export function getNewestMarkdownSlug(reviews: Review[]): string | null {
  if (reviews.length === 0) return null;
  const sorted = [...reviews].sort((a, b) => {
    const diff = publishedTime(b) - publishedTime(a);
    if (diff !== 0) return diff;
    return a.slug.localeCompare(b.slug);
  });
  return sorted[0]?.slug ?? null;
}

export function isNewestMarkdownContent(
  slug: string,
  reviews: Review[]
): boolean {
  const newest = getNewestMarkdownSlug(reviews);
  return newest !== null && newest === slug;
}
