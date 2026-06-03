import Link from "next/link";
import { formatReviewPublishedForList } from "@/lib/format-published-at";
import { reviewTitleSingleLine } from "@/lib/review-title";
import type { Review } from "@/lib/types";
import { ReviewCover } from "./ReviewCover";
import { ReviewDlsiteListPrice } from "./ReviewDlsiteListPrice";
import { ReviewOverlayBadges } from "./ReviewOverlayBadges";
import { StarRating } from "./StarRating";

type Props = {
  review: Review;
  priorityImage?: boolean;
  /** 一覧用：全 Markdown のうち最新1件だけ true */
  showNew?: boolean;
  /** 予約公開前（全年齢一覧）。リンクは `linkable` が false のとき無効 */
  preparing?: boolean;
  linkable?: boolean;
};

export function ReviewCard({
  review,
  priorityImage = false,
  showNew = false,
  preparing = false,
  linkable = true,
}: Props) {
  const best = review.ratingBest ?? 10;
  const titleOne = reviewTitleSingleLine(review.title);
  const cardClassName = [
    "block min-w-0 max-w-full overflow-hidden rounded-3xl border bg-slate-800/50 shadow-md shadow-slate-950/20 ring-1",
    preparing
      ? "border-slate-600/35 ring-slate-700/25"
      : "group border-slate-600/40 ring-slate-700/30 transition hover:-translate-y-0.5 hover:border-sky-500/35 hover:shadow-lg hover:shadow-sky-950/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/45",
  ].join(" ");

  const inner = (
    <>
        <div className="relative">
          <ReviewOverlayBadges
            review={review}
            showNew={showNew}
            preparing={preparing}
          />
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
            {preparing ? "公開予定" : "投稿"}{" "}
            {formatReviewPublishedForList(review)}
          </p>
          <h2
            className={`mt-1 text-lg font-semibold leading-snug tracking-tight line-clamp-2 ${
              linkable
                ? "text-slate-50 group-hover:text-sky-200"
                : "text-slate-200"
            }`}
          >
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
                className="rounded-lg border border-slate-600/50 bg-slate-900/55 px-2.5 py-1 text-xs font-medium text-sky-300/95"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
    </>
  );

  return (
    <article>
      {linkable ? (
        <Link href={`/reviews/${review.slug}/`} className={`group ${cardClassName}`}>
          {inner}
        </Link>
      ) : (
        <div className={cardClassName} aria-label={`${titleOne}（公開準備中）`}>
          {inner}
        </div>
      )}
    </article>
  );
}
