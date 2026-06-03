import type { Metadata } from "next";
import { Suspense } from "react";
import { DevSiteNextHeader } from "@/components/dev/DevSiteNextHeader";
import { ArticleList } from "@/components/ArticleList";
import { ARTICLES_LIST_HUB_PATH } from "@/lib/review-list-href";
import { getAllReviews } from "@/lib/reviews";
import { SITE_NAME } from "@/lib/site-brand";

export const metadata: Metadata = {
  title: "記事一覧",
  description:
    `催眠音声の解説・用語・視聴環境・おすすめ特集など、${SITE_NAME}の記事一覧です。`,
  alternates: { canonical: ARTICLES_LIST_HUB_PATH },
};

export default function ArticlesPage() {
  const reviews = getAllReviews();
  const useDevChrome = process.env.NODE_ENV === "development";

  return (
    <main className="mx-auto w-full max-w-6xl pb-10">
      {useDevChrome ? (
        <>
          <p className="border-b border-amber-600/30 bg-amber-950/20 px-4 py-2 text-center text-[11px] font-medium tracking-wide text-amber-200/90">
            次サイト草案と共通の記事一覧
          </p>
          <DevSiteNextHeader />
        </>
      ) : null}

      <Suspense
        fallback={
          <p className="mt-10 text-center text-sm text-slate-500">
            一覧を読み込んでいます…
          </p>
        }
      >
        <ArticleList
          markdownReviews={reviews}
          basePath={ARTICLES_LIST_HUB_PATH}
          listHeading="記事一覧"
          compact={useDevChrome}
        />
      </Suspense>
    </main>
  );
}
