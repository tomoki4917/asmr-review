import { isAllAgesReview } from "@/lib/reviews";
import {
  ARTICLES_LIST_HUB_PATH,
  KNOWLEDGE_COLUMNS_HUB_PATH,
  WORKS_LIST_HUB_PATH,
} from "@/lib/review-list-href";
import { ALL_AGES_SITE_BASE } from "@/lib/site-rating-switch";
import type { Review } from "@/lib/types";

export type ReviewBackLink = {
  href: string;
  label: string;
};

/** レビュー・記事詳細の「戻る」リンク先 */
export function resolveReviewBackLink(review: Review): ReviewBackLink {
  if (review.contentKind === "article") {
    if (review.tags.includes("視聴環境")) {
      return { href: "/listening-environment/", label: "視聴環境一覧へ" };
    }
    if (
      review.tags.includes("レビュー方法") ||
      review.slug === "evaluation-method"
    ) {
      return { href: "/evaluation-method/", label: "評価メソッドへ" };
    }
    if (review.tags.includes("記事")) {
      return { href: ARTICLES_LIST_HUB_PATH, label: "記事一覧へ" };
    }
    return { href: KNOWLEDGE_COLUMNS_HUB_PATH, label: "知識・コラムへ" };
  }

  if (isAllAgesReview(review)) {
    return { href: `${ALL_AGES_SITE_BASE}/works/`, label: "作品一覧へ" };
  }

  return { href: WORKS_LIST_HUB_PATH, label: "作品一覧へ" };
}
