import { Suspense } from "react";
import { CategoryHubHeader } from "@/components/CategoryHubHeader";
import { HomeReviewList } from "@/components/HomeReviewList";
import { ReviewListSearchForm } from "@/components/ReviewListSearchForm";
import { WORKS_LIST_HUB_INTRO } from "@/lib/works-list-hub";
import type { Review } from "@/lib/types";

type Props = {
  markdownReviews: Review[];
  basePath: string;
  breadcrumbHref: string;
};

/** 作品一覧専用ハブ（カテゴリヘッダー ＋ レビュー絞り込み一覧） */
export function WorksListHub({
  markdownReviews,
  basePath,
  breadcrumbHref,
}: Props) {
  return (
    <div className="px-4 pb-10 pt-8 sm:px-6 sm:pt-10">
      <CategoryHubHeader
        title="作品を探す"
        intro={WORKS_LIST_HUB_INTRO}
        emoji="🔍"
        breadcrumb={{ href: breadcrumbHref, label: "TOP" }}
      />
      <Suspense
        fallback={
          <p className="mt-6 text-center text-sm text-slate-500">
            検索・一覧を読み込んでいます…
          </p>
        }
      >
        <ReviewListSearchForm basePath={basePath} className="mt-6" />
        <div className="mt-4">
          <HomeReviewList
            markdownReviews={markdownReviews}
            basePath={basePath}
            reviewsOnly
            compact
            hideListHeading
          />
        </div>
      </Suspense>
    </div>
  );
}
