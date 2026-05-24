"use client";

import { HomeReviewList } from "@/components/HomeReviewList";
import type { Review } from "@/lib/types";

type Props = {
  markdownReviews: Review[];
  /** 絞り込み URL 基点（既定 `/articles/`） */
  basePath?: string;
  /** 一覧見出し */
  listHeading?: string;
  compact?: boolean;
};

/** 記事専用一覧（`HomeReviewList` の記事モードを1回転用） */
export function ArticleList({
  markdownReviews,
  basePath = "/articles/",
  listHeading = "記事一覧",
  compact = false,
}: Props) {
  return (
    <HomeReviewList
      markdownReviews={markdownReviews}
      basePath={basePath}
      articlesOnly
      listHeading={listHeading}
      compact={compact}
    />
  );
}
