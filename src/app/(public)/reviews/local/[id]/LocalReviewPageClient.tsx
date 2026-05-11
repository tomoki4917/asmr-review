"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ReviewMarkdown } from "@/components/ReviewMarkdown";
import { SummaryMarkdown } from "@/components/SummaryMarkdown";
import { ReviewCoverPlaceholder } from "@/components/ReviewCover";
import { StarRating } from "@/components/StarRating";
import {
  POSTED_REVIEWS_CHANGED_EVENT,
  effectivePostKind,
  isStarRatedReview,
  postedKindLabel,
  postedReviewRatingBest,
  readPostedReviewsFromStorage,
  type PostedReview,
} from "@/lib/posted-review";
import { reviewTitleSingleLine } from "@/lib/review-title";

export default function LocalReviewPageClient() {
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
    function load() {
      const list = readPostedReviewsFromStorage();
      setReview(list.find((r) => r.id === id) ?? null);
    }
    load();
    window.addEventListener(POSTED_REVIEWS_CHANGED_EVENT, load);
    return () => window.removeEventListener(POSTED_REVIEWS_CHANGED_EVENT, load);
  }, [id]);

  if (review === undefined) {
    return (
      <main className="mx-auto w-full max-w-3xl py-16 text-center text-sm text-slate-500">
        読み込み中…
      </main>
    );
  }

  if (review === null) {
    return (
      <main className="mx-auto w-full max-w-3xl py-16 text-center">
        <p className="text-slate-400">
          このブラウザの localStorage に該当する記事がありません。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-sky-300 hover:underline"
        >
          ← トップへ
        </Link>
      </main>
    );
  }

  const best = postedReviewRatingBest(review);
  const titleOne = reviewTitleSingleLine(review.title);
  const slug = `local-${review.id}`;
  const kind = effectivePostKind(review);
  const kindLabel = postedKindLabel(kind);
  const kindBadgeClass =
    kind === "article"
      ? "text-emerald-400/95"
      : kind === "author_article"
        ? "text-sky-400/95"
        : kind === "mechanism"
          ? "text-violet-400/95"
          : "text-amber-300/95";

  const articleReading = !isStarRatedReview(review);
  const titleHasBreak = review.title.includes("\n");

  return (
    <article
      className={`mx-auto w-full min-w-0 max-w-3xl py-8 sm:py-10 lg:max-w-4xl xl:max-w-5xl xl:py-11 ${articleReading ? "article-reading" : "review-reading"}`}
    >
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 transition hover:text-sky-200"
      >
        <span aria-hidden>←</span> トップへ
      </Link>

      <header className="mt-5 sm:mt-6">
        <div
          className={`overflow-hidden rounded-3xl border border-slate-600/45 bg-slate-800/50 shadow-lg shadow-slate-950/25 backdrop-blur-sm ${articleReading ? "article-hero-card" : ""}`}
        >
          <div className="relative aspect-[16/9] min-h-0 min-w-0 w-full max-w-full overflow-hidden sm:aspect-[2/1]">
            {review.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- 外部URL任意
              <img
                src={review.thumbnailUrl}
                alt={titleOne}
                className="h-full w-full object-cover"
              />
            ) : (
              <ReviewCoverPlaceholder slug={slug} />
            )}
          </div>
          <div
            className={`border-t border-slate-600/40 bg-slate-900/50 py-6 sm:px-8 sm:py-8 ${
              articleReading ? "px-5" : "px-4"
            }`}
          >
            <p
              className={`text-xs font-medium uppercase tracking-wider ${kindBadgeClass}`}
            >
              ブラウザ保存の投稿（他端末とは共有されません）· {kindLabel}
            </p>
            <h1
              className={`mt-2 text-2xl font-bold leading-tight tracking-tight text-slate-50 sm:text-3xl ${articleReading || titleHasBreak ? "whitespace-pre-line text-pretty" : "text-balance"} ${articleReading ? "max-sm:text-[1.7rem] max-sm:leading-snug" : ""}`}
            >
              {review.title}
            </h1>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              {isStarRatedReview(review) ? (
                <StarRating value={review.ratingValue} best={best} size="md" />
              ) : (
                <span className="text-sm text-slate-500">
                  星評価なし（記事）
                </span>
              )}
              <p className="text-sm text-slate-500">
                <time dateTime={review.publishedAt}>
                  {new Date(review.publishedAt).toLocaleString("ja-JP")}
                </time>
              </p>
            </div>
            <ul className="mt-5 flex flex-wrap gap-2">
              {review.tags.map((tag) => (
                <li
                  key={tag}
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold ${articleReading ? "article-tag-pill" : "border-sky-800/35 bg-sky-950/30 text-sky-200/90"}`}
                >
                  {tag}
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <SummaryMarkdown markdown={review.summary} />
            </div>
            {review.dlsiteUrl && (
              <p className="mt-4">
                <a
                  href={review.dlsiteUrl}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-xl border border-sky-600/45 bg-sky-950/35 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-900/30"
                >
                  DLsite で見る
                </a>
              </p>
            )}
          </div>
        </div>
      </header>

      <section
        className={`mt-8 min-w-0 rounded-3xl border border-slate-600/45 bg-slate-800/50 shadow-md shadow-slate-950/20 backdrop-blur-sm sm:mt-9 sm:px-8 sm:py-9 ${articleReading ? "article-body-shell px-5 py-8 max-sm:py-8" : "px-4 py-7"}`}
      >
        {review.body ? (
          <ReviewMarkdown
            markdown={review.body}
            articleReading={articleReading}
            starReviewReadingComfort={isStarRatedReview(review)}
          />
        ) : (
          <p className="text-slate-500">本文がありません。</p>
        )}
      </section>
    </article>
  );
}
