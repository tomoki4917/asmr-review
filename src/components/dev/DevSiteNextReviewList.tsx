"use client";

import { HomeReviewList } from "@/components/HomeReviewList";
import type { Review } from "@/lib/types";

type Props = {
  markdownReviews: Review[];
};

/** `/dev/site-next/`：現行トップと同じ絞り込み＋レビュー一覧（同一ページ内） */
export function DevSiteNextReviewList({ markdownReviews }: Props) {
  return (
    <HomeReviewList
      markdownReviews={markdownReviews}
      basePath="/dev/site-next/"
      reviewsOnly
      compact
    />
  );
}
