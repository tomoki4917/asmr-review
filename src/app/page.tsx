import { MoodDiagnosticModal } from "@/components/MoodDiagnosticModal";
import { ReviewFilterList } from "@/components/ReviewFilterList";
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
          一人で書き、読むだけの静かな部屋です。気になる作品を星とタグで眺めて、記事へどうぞ。
        </p>
        <div className="mt-8 flex justify-center">
          <MoodDiagnosticModal />
        </div>
      </header>

      {reviews.length === 0 ? (
        <p className="mx-auto mt-16 max-w-xl rounded-3xl border border-dashed border-stone-300 bg-white/80 p-8 text-center text-sm leading-relaxed text-stone-600 shadow-inner dark:border-stone-600 dark:bg-stone-900/50 dark:text-stone-400">
          まだレビューがありません。{" "}
          <code className="rounded-md bg-stone-200 px-2 py-0.5 font-mono text-xs text-stone-800 dark:bg-stone-800 dark:text-stone-200">
            src/content/
          </code>{" "}
          に{" "}
          <code className="rounded-md bg-stone-200 px-2 py-0.5 font-mono text-xs text-stone-800 dark:bg-stone-800 dark:text-stone-200">
            .md
          </code>{" "}
          を追加すると、自動で一覧に表示されます（{" "}
          <code className="rounded-md bg-stone-200 px-2 py-0.5 font-mono text-xs text-stone-800 dark:bg-stone-800 dark:text-stone-200">
            _template.md
          </code>{" "}
          を複製して先頭の{" "}
          <code className="rounded-md bg-stone-200 px-2 py-0.5 font-mono text-xs text-stone-800 dark:bg-stone-800 dark:text-stone-200">
            _
          </code>{" "}
          を外すと早いです）。
        </p>
      ) : (
        <section className="mt-14 sm:mt-16" aria-labelledby="reviews-heading">
          <div className="mb-8 flex flex-col gap-2 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="reviews-heading"
                className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-2xl"
              >
                レビュー一覧
              </h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                {reviews.length} 件の記事
              </p>
            </div>
          </div>
          <ReviewFilterList reviews={reviews} />
        </section>
      )}
    </main>
  );
}
