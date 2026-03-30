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
        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
          催眠音声紹介部屋
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-stone-600 dark:text-stone-400">
          レビュー・筆者記事・メカニズム解説をまとめています。Markdown の記事と、このブラウザに保存した投稿の両方が表示されます。右側のメニューでレビュー評価ごとに絞り込めます。
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
