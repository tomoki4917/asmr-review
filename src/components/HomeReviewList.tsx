"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  POSTED_REVIEWS_STORAGE_KEY,
  effectivePostKind,
  isStarRatedReview,
  postedKindLabel,
  readPostedReviewsFromStorage,
  starBucket,
  type PostedReview,
} from "@/lib/posted-review";
import type { Review } from "@/lib/types";
import { RatingStarsSidebar } from "@/components/RatingStarsSidebar";
import { ReviewCard } from "@/components/ReviewCard";
import { ReviewCoverPlaceholder } from "@/components/ReviewCover";
import { StarRating } from "@/components/StarRating";

type MergedReviewItem =
  | { kind: "file"; review: Review }
  | { kind: "local"; review: PostedReview };

function mergeReviews(
  markdownReviews: Review[],
  posted: PostedReview[]
): MergedReviewItem[] {
  const reviewPosted = posted.filter((p) => effectivePostKind(p) === "review");
  const items: MergedReviewItem[] = [
    ...markdownReviews.map((review) => ({ kind: "file" as const, review })),
    ...reviewPosted.map((review) => ({ kind: "local" as const, review })),
  ];
  items.sort((a, b) => {
    const ta = Date.parse(
      a.kind === "file" ? a.review.publishedAt : a.review.publishedAt
    );
    const tb = Date.parse(
      b.kind === "file" ? b.review.publishedAt : b.review.publishedAt
    );
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
  return items;
}

function matchesStarFilter(item: MergedReviewItem, stars: number): boolean {
  const v =
    item.kind === "file" ? item.review.ratingValue : item.review.ratingValue;
  return starBucket(v) === stars;
}

function LocalPostedCard({ review }: { review: PostedReview }) {
  const best = 5;
  const slug = `local-${review.id}`;
  const kind = effectivePostKind(review);
  const label = postedKindLabel(kind);
  const badgeClass =
    kind === "author_article"
      ? "text-sky-800 dark:text-sky-200/90"
      : kind === "mechanism"
        ? "text-violet-800 dark:text-violet-200/90"
        : "text-amber-800 dark:text-amber-200/90";

  return (
    <article>
      <Link
        href={`/reviews/local/${review.id}`}
        className="group block min-w-0 max-w-full overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm ring-1 ring-stone-950/[0.04] transition hover:-translate-y-0.5 hover:border-indigo-200/80 hover:shadow-lg hover:shadow-indigo-950/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-stone-800 dark:bg-stone-900 dark:ring-white/[0.06] dark:hover:border-indigo-500/40 dark:hover:shadow-indigo-950/30"
      >
        <div className="relative aspect-[16/9] min-h-0 min-w-0 w-full max-w-full overflow-hidden bg-stone-100 dark:bg-stone-800 sm:aspect-[2/1]">
          <ReviewCoverPlaceholder slug={slug} />
        </div>
        <div className="p-5 sm:p-6">
          <p
            className={`text-xs font-medium uppercase tracking-wider ${badgeClass}`}
          >
            ブラウザ保存 · {label}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-stone-900 line-clamp-2 group-hover:text-indigo-800 dark:text-stone-50 dark:group-hover:text-indigo-200">
            {review.title}
          </h2>
          {isStarRatedReview(review) && (
            <div className="mt-3">
              <StarRating value={review.ratingValue} best={best} size="sm" />
            </div>
          )}
          <ul className="mt-4 flex flex-wrap gap-2">
            {review.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      </Link>
    </article>
  );
}

function ArticleGrid({
  items,
  emptyText,
}: {
  items: PostedReview[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 px-4 py-8 text-center text-sm text-stone-600 dark:border-stone-600 dark:bg-stone-900/40 dark:text-stone-400">
        {emptyText}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-10">
      {items.map((review) => (
        <li key={review.id} className="min-w-0">
          <LocalPostedCard review={review} />
        </li>
      ))}
    </ul>
  );
}

type Props = {
  markdownReviews: Review[];
};

export function HomeReviewList({ markdownReviews }: Props) {
  const searchParams = useSearchParams();
  const starsRaw = searchParams.get("stars");
  const starFilter =
    starsRaw != null && /^[1-5]$/.test(starsRaw) ? Number(starsRaw) : null;

  const [posted, setPosted] = useState<PostedReview[]>([]);

  const reloadPosted = useCallback(() => {
    setPosted(readPostedReviewsFromStorage());
  }, []);

  useEffect(() => {
    reloadPosted();
    function onStorage(ev: StorageEvent) {
      if (ev.key === POSTED_REVIEWS_STORAGE_KEY || ev.key === null) {
        reloadPosted();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [reloadPosted]);

  const mergedReviews = useMemo(
    () => mergeReviews(markdownReviews, posted),
    [markdownReviews, posted]
  );

  const filteredReviews = useMemo(() => {
    if (starFilter === null) return mergedReviews;
    return mergedReviews.filter((item) => matchesStarFilter(item, starFilter));
  }, [mergedReviews, starFilter]);

  const authorArticles = useMemo(() => {
    return posted
      .filter((p) => effectivePostKind(p) === "author_article")
      .sort(
        (a, b) =>
          Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
      );
  }, [posted]);

  const mechanismArticles = useMemo(() => {
    return posted
      .filter((p) => effectivePostKind(p) === "mechanism")
      .sort(
        (a, b) =>
          Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
      );
  }, [posted]);

  const hasAnyContent =
    mergedReviews.length > 0 ||
    authorArticles.length > 0 ||
    mechanismArticles.length > 0;

  if (!hasAnyContent) {
    return (
      <p className="mx-auto mt-16 max-w-xl rounded-3xl border border-dashed border-stone-300 bg-white/80 p-8 text-center text-sm leading-relaxed text-stone-600 shadow-inner dark:border-stone-600 dark:bg-stone-900/50 dark:text-stone-400">
        まだ表示できる投稿がありません。Markdown の記事を{" "}
        <code className="rounded-md bg-stone-200 px-2 py-0.5 font-mono text-xs text-stone-800 dark:bg-stone-800 dark:text-stone-200">
          src/content/
        </code>{" "}
        に置くか、管理人用ページから追加してください。
      </p>
    );
  }

  return (
    <div className="mt-14 flex flex-col-reverse gap-10 lg:mt-16 lg:flex-row lg:items-start lg:gap-10 xl:gap-12">
      <div className="min-w-0 flex-1 space-y-16 sm:space-y-20">
        <section aria-labelledby="reviews-heading">
          <div className="mb-8 sm:mb-10">
            <h2
              id="reviews-heading"
              className="scroll-mt-24 text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:scroll-mt-28 sm:text-2xl"
            >
              レビュー一覧
              {starFilter !== null ? (
                <span className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">
                  {" "}
                  （★{starFilter}）
                </span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {filteredReviews.length} 件
              {starFilter !== null && mergedReviews.length > 0
                ? ` / 全レビュー ${mergedReviews.length} 件`
                : null}
            </p>
          </div>

          {filteredReviews.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 px-4 py-10 text-center text-sm text-stone-600 dark:border-stone-600 dark:bg-stone-900/40 dark:text-stone-400">
              {starFilter !== null
                ? `★${starFilter}のレビューはまだありません。右のメニューで「すべて」を選ぶと全件表示されます。`
                : "レビューがありません。"}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-10">
              {filteredReviews.map((item, index) => (
                <li
                  key={item.kind === "file" ? item.review.slug : item.review.id}
                  className="min-w-0"
                >
                  {item.kind === "file" ? (
                    <ReviewCard review={item.review} priorityImage={index < 2} />
                  ) : (
                    <LocalPostedCard review={item.review} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="author-posts-heading">
          <div className="mb-8 sm:mb-10">
            <h2
              id="author-posts-heading"
              className="scroll-mt-24 text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:scroll-mt-28 sm:text-2xl"
            >
              筆者投稿記事
            </h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {authorArticles.length} 件
            </p>
          </div>
          <ArticleGrid
            items={authorArticles}
            emptyText="筆者投稿記事はまだありません。投稿ページの「投稿の種類」から追加できます。"
          />
        </section>

        <section aria-labelledby="mechanism-heading">
          <div className="mb-8 sm:mb-10">
            <h2
              id="mechanism-heading"
              className="scroll-mt-24 text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:scroll-mt-28 sm:text-2xl"
            >
              催眠音声のメカニズム
            </h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {mechanismArticles.length} 件
            </p>
          </div>
          <ArticleGrid
            items={mechanismArticles}
            emptyText="このカテゴリの記事はまだありません。投稿ページの「投稿の種類」から追加できます。"
          />
        </section>
      </div>

      <aside className="shrink-0 lg:sticky lg:top-24 lg:w-52 xl:w-56">
        <RatingStarsSidebar />
      </aside>
    </div>
  );
}
