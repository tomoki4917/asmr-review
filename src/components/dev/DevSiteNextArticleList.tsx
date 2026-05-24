"use client";

import { ArticleList } from "@/components/ArticleList";
import type { Review } from "@/lib/types";

type Props = {
  markdownReviews: Review[];
};

/** `/dev/site-next/articles/`：記事一覧（レビュー一覧と同型の絞り込みバー） */
export function DevSiteNextArticleList({ markdownReviews }: Props) {
  return (
    <ArticleList
      markdownReviews={markdownReviews}
      basePath="/dev/site-next/articles/"
      listHeading="記事一覧"
      compact
    />
  );
}
