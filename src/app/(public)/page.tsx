import { Suspense } from "react";
import { HomeReviewList } from "@/components/HomeReviewList";
import { MoodDiagnosticModal } from "@/components/MoodDiagnosticModal";
import { PsychologyInsightsSection } from "@/components/PsychologyInsightsSection";
import { getAllReviews } from "@/lib/reviews";

export default function HomePage() {
  const reviews = getAllReviews();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400/90">
          hypnosis · ASMR · psychology
        </p>
        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          催眠音声紹介部屋
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-slate-400">
          作品レビューと、なぜ心地よく感じるのかの心理学的な視点をまとめています。Markdown（
          <code className="rounded-md border border-slate-600/60 bg-slate-800/80 px-2 py-0.5 font-mono text-sm text-sky-200/90">
            src/content/
          </code>
          ）の記事と、管理者が同一ブラウザに保存した投稿が並びます。データは{" "}
          <strong className="font-semibold text-slate-200">localStorage</strong>
          でトップと管理画面を共有しています。
        </p>
        <div className="mt-8 flex justify-center">
          <MoodDiagnosticModal />
        </div>
      </header>

      <PsychologyInsightsSection />

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
