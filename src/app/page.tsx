import { Suspense } from "react";
import { HomeReviewList } from "@/components/HomeReviewList";
import { getAllReviews } from "@/lib/reviews";

export default function HomePage() {
  const reviews = getAllReviews();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600 dark:text-indigo-400">
          個人レビューブログ
        </p>
        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-black dark:text-white sm:text-4xl">
          催眠音声紹介部屋
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-stone-600 dark:text-stone-400">
          Markdown の記事（
          <code className="rounded bg-stone-200/80 px-1 py-0.5 font-mono text-[0.85em] dark:bg-stone-800">
            src/content/
          </code>
          ）と、管理人用の専用 URL から保存したレビュー・記事（このブラウザの localStorage）が並びます。レビューは右のメニューで星の数に絞り込めます。
        </p>
      </header>

      <Suspense
        fallback={
          <p className="mt-14 text-center text-sm text-stone-500 dark:text-stone-400">
            一覧を読み込んでいます…
          </p>
        }
      >
        <HomeReviewList markdownReviews={reviews} />
      </Suspense>
    </main>
  );
}
