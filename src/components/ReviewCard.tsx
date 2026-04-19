import Link from "next/link";
import { formatPublishedAtForList } from "@/lib/format-published-at";
import { reviewTitleSingleLine } from "@/lib/review-title";
import type { Review } from "@/lib/types";
import { ReviewCover } from "./ReviewCover";
import { ReviewDlsiteListPrice } from "./ReviewDlsiteListPrice";
import { ReviewNewBadge } from "./ReviewNewBadge";
import { StarRating } from "./StarRating";

type Props = {
  review: Review;
  priorityImage?: boolean;
  /** 一覧用：全 Markdown のうち最新1件だけ true */
  showNew?: boolean;
};

export function ReviewCard({
  review,
  priorityImage = false,
  showNew = false,
}: Props) {
  const best = review.ratingBest ?? 10;
  const titleOne = reviewTitleSingleLine(review.title);

  return (
    <article>
      <Link
        href={`/reviews/${review.slug}`}
        className="group block min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-600/40 bg-slate-800/50 shadow-md shadow-slate-950/20 ring-1 ring-slate-700/30 transition hover:-translate-y-0.5 hover:border-sky-500/35 hover:shadow-lg hover:shadow-sky-950/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/45"
      >
        <div className="relative">
          {showNew ? (
            <div className="absolute right-3 top-3 z-10">
              <ReviewNewBadge variant="overlay" />
            </div>
          ) : null}
          <ReviewCover
            coverImage={review.coverImage}
            alt={titleOne}
            slug={review.slug}
            priority={priorityImage}
            className="rounded-t-3xl group-focus-visible:rounded-t-3xl"
          />
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-xs tabular-nums text-slate-500">
            投稿 {formatPublishedAtForList(review.publishedAt)}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-slate-50 line-clamp-2 group-hover:text-sky-200">
            {titleOne}
          </h2>
          {review.contentKind === "review" && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <StarRating value={review.ratingValue} best={best} size="sm" />
              <ReviewDlsiteListPrice review={review} />
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
