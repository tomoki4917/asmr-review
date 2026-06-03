import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AllAgesHomeEditorial } from "@/components/all-ages/AllAgesHomeEditorial";
import { HomeHeroSection } from "@/components/home/HomeHeroSection";
import { HomeReviewList } from "@/components/HomeReviewList";
import { ReviewListSearchForm } from "@/components/ReviewListSearchForm";
import {
  ALL_AGES_WORKS_PATH,
  ALL_AGES_WORKS_INTRO,
  allAgesReviewListHref,
} from "@/lib/all-ages-site-chrome";
import { SITE_NAME_ALL_AGES } from "@/lib/site-brand";
import { getAllAgesReviewsForList } from "@/lib/reviews";
import { isReviewVisibleByGoLiveAt } from "@/lib/review-visibility";
import { ALL_AGES_SITE_BASE } from "@/lib/site-rating-switch";

export const metadata: Metadata = {
  title: `${SITE_NAME_ALL_AGES}（全年齢向け）`,
  description: `全年齢向けの${SITE_NAME_ALL_AGES}。同人音声のレビュー・解説を掲載しています。`,
  alternates: { canonical: ALL_AGES_SITE_BASE },
};

export default function AllAgesHomePage() {
  const reviews = getAllAgesReviewsForList();
  const now = new Date();
  const preparingCount = reviews.filter(
    (r) => r.contentKind === "review" && !isReviewVisibleByGoLiveAt(r, now)
  ).length;

  return (
    <main className="mx-auto w-full max-w-7xl py-10 sm:py-14">
      <HomeHeroSection siteName={SITE_NAME_ALL_AGES} />

      <AllAgesHomeEditorial reviews={reviews} />

      <section className="mx-auto mt-12 max-w-3xl px-4 text-center sm:mt-14 sm:px-0">
        <h2 className="text-lg font-bold tracking-tight text-sky-200 sm:text-xl">
          レビュー一覧
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {ALL_AGES_WORKS_INTRO}
          公開前の記事は一覧に「準備中」として表示します。成人向け【R18】の記事は
          <Link
            href="/"
            className="text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
          >
            R18 サイト
          </Link>
          をご覧ください。
        </p>
        {preparingCount > 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            「準備中」は公開予定のレビューです。記事ページは公開日になりましたらお読みいただけます。
          </p>
        ) : null}
      </section>

      <Suspense
        fallback={
          <p className="mx-auto mt-10 max-w-xl text-center text-sm text-slate-500">
            検索・一覧を読み込んでいます…
          </p>
        }
      >
        <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-0">
          <ReviewListSearchForm
            basePath={ALL_AGES_SITE_BASE}
            className="mx-auto max-w-3xl"
          />
        </div>
        <HomeReviewList
          markdownReviews={reviews}
          basePath={ALL_AGES_SITE_BASE}
          reviewsOnly
          listPreparingMode
          hideGenreFilter
        />
      </Suspense>

      <p className="mt-10 text-center">
        <Link
          href="/"
          className="text-sm font-medium text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
        >
          成人向け【R18】サイトへ
        </Link>
        {" · "}
        <Link
          href={allAgesReviewListHref({ sort: "new" })}
          className="text-sm font-medium text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
        >
          作品一覧ハブ
        </Link>
      </p>
    </main>
  );
}
