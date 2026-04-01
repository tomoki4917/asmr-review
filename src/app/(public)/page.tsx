import { Suspense } from "react";
import { HomeReviewList } from "@/components/HomeReviewList";
import { MoodDiagnosticModal } from "@/components/MoodDiagnosticModal";
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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400/90">
          hypnosis · ASMR · psychology
        </p>
        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          ASMR音声紹介ラボ
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-slate-400">
          作品レビューと、<strong className="font-semibold text-slate-200">催眠音声がはじめての方</strong>
          向けの解説をまとめています。「怪しい」「自分には無理」という先入観のまえに、
          <span className="text-slate-300">仕組みから順に読むだけで全体像がつかめます。</span>
        </p>
        <div className="mt-8 flex justify-center">
          <MoodDiagnosticModal />
        </div>
      </header>

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
