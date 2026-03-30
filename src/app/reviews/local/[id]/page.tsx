"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ReviewMarkdown } from "@/components/ReviewMarkdown";
import { ReviewCoverPlaceholder } from "@/components/ReviewCover";
import { StarRating } from "@/components/StarRating";
import {
  effectivePostKind,
  isStarRatedReview,
  postedKindLabel,
  readPostedReviewsFromStorage,
  type PostedReview,
} from "@/lib/posted-review";

export default function LocalReviewPage() {
  const params = useParams();
  const raw = params.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const [review, setReview] = useState<PostedReview | null | undefined>(
    undefined
  );

  useEffect(() => {
    if (!id) {
      setReview(null);
      return;
    }
    const list = readPostedReviewsFromStorage();
    setReview(list.find((r) => r.id === id) ?? null);
  }, [id]);

  if (review === undefined) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-stone-500 dark:text-stone-400">
        読み込み中…
      </main>
    );
  }

  if (review === null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-stone-600 dark:text-stone-400">
          このブラウザの localStorage に該当する記事がありません。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-400"
        >
          ← トップへ
        </Link>
      </main>
    );
  }

  const best = 5;
  const slug = `local-${review.id}`;
  const kind = effectivePostKind(review);
  const kindLabel = postedKindLabel(kind);

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-indigo-700 transition hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200"
      >
        <span aria-hidden>←</span> トップへ
      </Link>

      <header className="mt-6">
        <div className="overflow-hidden rounded-3xl border border-stone-200/90 bg-stone-100 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="relative aspect-[16/9] min-h-0 min-w-0 w-full max-w-full overflow-hidden sm:aspect-[2/1]">
            <ReviewCoverPlaceholder slug={slug} />
          </div>
          <div className="border-t border-stone-200/80 bg-white px-5 py-6 dark:border-stone-800 dark:bg-stone-950 sm:px-8 sm:py-8">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-800 dark:text-amber-200/90">
              ブラウザ保存の投稿（他端末とは共有されません）· {kindLabel}
            </p>
            <h1 className="mt-2 text-balance text-2xl font-bold leading-tight tracking-tight text-stone-900 dark:text-stone-50 sm:text-3xl">
              {review.title}
            </h1>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              {isStarRatedReview(review) ? (
                <StarRating value={review.ratingValue} best={best} size="md" />
              ) : (
                <span className="text-sm text-stone-500 dark:text-stone-400">
                  評価なし（記事）
                </span>
              )}
              <p className="text-sm text-stone-500 dark:text-stone-400">
                <time dateTime={review.publishedAt}>
                  {new Date(review.publishedAt).toLocaleString("ja-JP")}
                </time>
              </p>
            </div>
            <ul className="mt-5 flex flex-wrap gap-2">
              {review.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200"
                >
                  {tag}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-pretty text-base leading-relaxed text-stone-600 dark:text-stone-400">
              {review.summary}
            </p>
          </div>
        </div>
      </header>

      <section className="mt-10 rounded-3xl border border-stone-200/90 bg-white px-5 py-8 shadow-sm dark:border-stone-800 dark:bg-stone-900/40 sm:px-8 sm:py-10">
        {review.body ? (
          <ReviewMarkdown markdown={review.body} />
        ) : (
          <p className="text-stone-500 dark:text-stone-400">本文がありません。</p>
        )}
      </section>
    </article>
  );
}
