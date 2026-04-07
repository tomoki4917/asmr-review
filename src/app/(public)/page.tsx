import Link from "next/link";
import { Suspense } from "react";
import { AdMaxUnit } from "@/components/AdMaxUnit";
import { HomeReviewList } from "@/components/HomeReviewList";
import { PsychologyInsightsSection } from "@/components/PsychologyInsightsSection";
import { getAllReviews } from "@/lib/reviews";
import type { Review } from "@/lib/types";

const BEGINNER_GUIDE_SLUGS = [
  "hypnosis-mechanism-01",
  "nou-iki-toha",
  "dry-orgasm-what-is",
] as const;

function pickBeginnerGuides(reviews: Review[]): Review[] {
  return BEGINNER_GUIDE_SLUGS.map((slug) =>
    reviews.find((r) => r.slug === slug)
  ).filter((r): r is Review => r != null);
}

export default function HomePage() {
  const reviews = getAllReviews();
  const beginnerGuides = pickBeginnerGuides(reviews);

  return (
    <main className="mx-auto w-full max-w-6xl py-10 sm:py-14">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400/90">
          hypnosis · ASMR · psychology
        </p>
        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          同人音声紹介ラボ
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-slate-400">
          主に同人音声を主観と客観的なデータに基づいてレビューさせていただいております。色んな作品が溢れている昨今、「少しでも読者様の参考になれば」という思いで投稿しています。
        </p>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-base leading-relaxed text-slate-400">
          忖度無しのガチレビューです。
        </p>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-base leading-relaxed text-slate-400">
          質問などあれば
          <Link
            href="/contact/"
            className="font-medium text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
          >
            問い合わせフォーム
          </Link>
          にてお待ちしております。
        </p>
      </header>

      <div className="mx-auto mt-10 flex justify-center overflow-x-hidden">
        <AdMaxUnit placement="home-top" />
      </div>

      <PsychologyInsightsSection beginnerGuides={beginnerGuides} />

      <Suspense
        fallback={
          <p className="mt-14 text-center text-sm text-slate-500">
            一覧を読み込んでいます…
          </p>
        }
      >
        <HomeReviewList markdownReviews={reviews} />
      </Suspense>
    </main>
  );
}
