import type { Metadata } from "next";
import Link from "next/link";
import { AllAgesReviewList } from "@/components/AllAgesReviewList";
import { HomeHeroSection } from "@/components/home/HomeHeroSection";
import { SITE_NAME_ALL_AGES } from "@/lib/site-brand";
import { getAllAgesReviewsForList } from "@/lib/reviews";
import { ALL_AGES_SITE_BASE } from "@/lib/site-rating-switch";

export const metadata: Metadata = {
  title: `${SITE_NAME_ALL_AGES}（全年齢向け）`,
  description: `全年齢向けの${SITE_NAME_ALL_AGES}。同人音声のレビュー・解説を掲載しています。`,
  alternates: { canonical: ALL_AGES_SITE_BASE },
};

export default function AllAgesHomePage() {
  const reviews = getAllAgesReviewsForList();

  return (
    <main className="mx-auto w-full max-w-7xl py-10 sm:py-14">
      <HomeHeroSection siteName={SITE_NAME_ALL_AGES} />

      <section className="mx-auto max-w-3xl px-4 text-center sm:px-0">
        <h2 className="text-lg font-bold tracking-tight text-sky-200 sm:text-xl">
          レビュー一覧
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          全年齢向け作品のレビューのみ掲載しています。公開前の記事は一覧に「準備中」として表示します。成人向け【R18】の記事は
          <Link href="/" className="text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline">
            R18 サイト
          </Link>
          をご覧ください。
        </p>
      </section>

      <AllAgesReviewList reviews={reviews} />

      <p className="mt-10 text-center">
        <Link
          href="/"
          className="text-sm font-medium text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
        >
          成人向け【R18】サイトへ
        </Link>
      </p>
    </main>
  );
}
