"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  POSTED_REVIEWS_CHANGED_EVENT,
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
import { FileMarkdownArticleCard } from "@/components/FileMarkdownArticleCard";
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
  const mdReviews = markdownReviews.filter((r) => r.contentKind === "review");
  const reviewPosted = posted.filter((p) => effectivePostKind(p) === "review");
  const items: MergedReviewItem[] = [
    ...mdReviews.map((review) => ({ kind: "file" as const, review })),
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
    kind === "article"
      ? "text-emerald-400/95"
      : kind === "author_article"
        ? "text-sky-400/95"
        : kind === "mechanism"
          ? "text-violet-400/95"
          : "text-amber-300/95";

  return (
    <article>
      <Link
        href={`/reviews/local/${review.id}`}
        className="group block min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-600/40 bg-slate-800/50 shadow-md shadow-slate-950/20 ring-1 ring-slate-700/30 transition hover:-translate-y-0.5 hover:border-sky-500/35 hover:shadow-lg hover:shadow-sky-950/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/45"
      >
        <div className="relative aspect-[16/9] min-h-0 min-w-0 w-full max-w-full overflow-hidden bg-slate-900 sm:aspect-[2/1]">
          {review.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 外部URL任意のため
            <img
              src={review.thumbnailUrl}
              alt={review.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <ReviewCoverPlaceholder slug={slug} />
          )}
        </div>
        <div className="p-5 sm:p-6">
          <p
            className={`text-xs font-medium uppercase tracking-wider ${badgeClass}`}
          >
            ブラウザ保存 · {label}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-slate-50 line-clamp-2 group-hover:text-sky-200">
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
                className="rounded-lg border border-slate-600/45 bg-slate-900/40 px-2.5 py-1 text-xs font-medium text-slate-400"
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
    function onLocalUpdate() {
      reloadPosted();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(POSTED_REVIEWS_CHANGED_EVENT, onLocalUpdate);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(POSTED_REVIEWS_CHANGED_EVENT, onLocalUpdate);
    };
  }, [reloadPosted]);

  const markdownArticles = useMemo(
    () => markdownReviews.filter((r) => r.contentKind === "article"),
    [markdownReviews]
  );

  const mergedReviews = useMemo(
    () => mergeReviews(markdownReviews, posted),
    [markdownReviews, posted]
  );

  const filteredReviews = useMemo(() => {
    if (starFilter === null) return mergedReviews;
    return mergedReviews.filter((item) => matchesStarFilter(item, starFilter));
  }, [mergedReviews, starFilter]);

  const articlePosts = useMemo(() => {
    return posted
      .filter((p) => {
        const k = effectivePostKind(p);
        return k === "article" || k === "author_article";
      })
      .sort(
        (a, b) =>
          Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
      );
  }, [posted]);

  const combinedArticleEntries = useMemo(() => {
    type Entry =
      | { source: "file"; review: Review; t: number }
      | { source: "local"; post: PostedReview; t: number };
    const fromFile: Entry[] = markdownArticles.map((review) => ({
      source: "file",
      review,
      t: Date.parse(review.publishedAt),
    }));
    const fromLocal: Entry[] = articlePosts.map((post) => ({
      source: "local",
      post,
      t: Date.parse(post.publishedAt),
    }));
    return [...fromFile, ...fromLocal].sort(
      (a, b) => (Number.isNaN(b.t) ? 0 : b.t) - (Number.isNaN(a.t) ? 0 : a.t)
    );
  }, [markdownArticles, articlePosts]);

  const hasAnyContent =
    mergedReviews.length > 0 ||
    markdownArticles.length > 0 ||
    articlePosts.length > 0;

  if (!hasAnyContent) {
    return (
      <p className="mx-auto mt-16 max-w-xl rounded-3xl border border-dashed border-slate-600/50 bg-slate-800/45 p-8 text-center text-sm leading-relaxed text-slate-400 shadow-inner shadow-slate-950/20">
        まだ表示できる投稿がありません。Markdown の記事を{" "}
        <code className="rounded-md border border-slate-600/60 bg-slate-900 px-2 py-0.5 font-mono text-xs text-sky-200/90">
          src/content/
        </code>{" "}
        に置くか、同一ブラウザで{" "}
        <code className="rounded-md border border-slate-600/60 bg-slate-900 px-2 py-0.5 font-mono text-xs text-sky-200/90">
          /admin
        </code>{" "}
        （パスワード保護）から投稿すると一覧に表示されます。
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
              className="scroll-mt-24 text-xl font-bold tracking-tight text-slate-50 sm:scroll-mt-28 sm:text-2xl"
            >
              レビュー一覧
              {starFilter !== null ? (
                <span className="text-lg font-semibold text-sky-300">
                  {" "}
                  （★{starFilter}）
                </span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredReviews.length} 件
              {starFilter !== null && mergedReviews.length > 0
                ? ` / 全レビュー ${mergedReviews.length} 件`
                : null}
            </p>
          </div>

          {filteredReviews.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-600/50 bg-slate-800/40 px-4 py-10 text-center text-sm text-slate-500">
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
              className="scroll-mt-24 text-xl font-bold tracking-tight text-slate-50 sm:scroll-mt-28 sm:text-2xl"
            >
              記事
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {combinedArticleEntries.length} 件
            </p>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Markdown で{" "}
              <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-sky-200/90">
                contentKind: article
              </code>{" "}
              の記事、および /admin から保存した「記事」・筆者投稿がここに並びます。
            </p>
          </div>
          {combinedArticleEntries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-600/50 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-500">
              記事はまだありません。Markdown のフロントマターに{" "}
              <code className="rounded bg-slate-800 px-1 font-mono text-xs">
                contentKind: article
              </code>{" "}
              を付けるか、/admin から「記事」として投稿できます。
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-10">
              {combinedArticleEntries.map((entry, index) => (
                <li key={entry.source === "file" ? entry.review.slug : entry.post.id} className="min-w-0">
                  {entry.source === "file" ? (
                    <FileMarkdownArticleCard
                      review={entry.review}
                      priorityImage={index < 2}
                    />
                  ) : (
                    <LocalPostedCard review={entry.post} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="shrink-0 lg:sticky lg:top-24 lg:w-52 xl:w-56">
        <RatingStarsSidebar />
      </aside>
    </div>
  );
}
