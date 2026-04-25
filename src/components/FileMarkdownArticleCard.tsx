import Link from "next/link";
import { formatReviewPublishedForList } from "@/lib/format-published-at";
import {
  getDlsiteProductById,
  isDlsiteProductShinsaku,
} from "@/lib/dlsite-product-catalog";
import { reviewTitleSingleLine } from "@/lib/review-title";
import type { Review } from "@/lib/types";
import { ReviewCover } from "./ReviewCover";
import { ReviewNewBadge } from "./ReviewNewBadge";
import { ShinsakuBadge } from "./ShinsakuBadge";

type Props = {
  review: Review;
  priorityImage?: boolean;
  showNew?: boolean;
};

/** `contentKind: article` の Markdown 記事用カード（星なし） */
export function FileMarkdownArticleCard({
  review,
  priorityImage = false,
  showNew = false,
}: Props) {
  const titleOne = reviewTitleSingleLine(review.title);
  const now = new Date();
  const dlsiteProduct =
    review.dlsiteProductId != null
      ? getDlsiteProductById(review.dlsiteProductId)
      : undefined;
  const showShinsaku = isDlsiteProductShinsaku(dlsiteProduct, now);
  const showBadgeStack = showNew || showShinsaku;

  return (
    <article>
      <Link
        href={`/reviews/${review.slug}`}
        className="group block min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-600/40 bg-slate-800/50 shadow-md shadow-slate-950/20 ring-1 ring-slate-700/30 transition hover:-translate-y-0.5 hover:border-sky-500/35 hover:shadow-lg hover:shadow-sky-950/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/45"
      >
        <div className="relative">
          {showBadgeStack ? (
            <div className="absolute right-3 top-3 z-10 flex max-w-[min(100%,calc(100%-1.5rem))] flex-wrap justify-end gap-1.5">
              {showNew ? <ReviewNewBadge variant="overlay" /> : null}
              {showShinsaku ? <ShinsakuBadge variant="overlay" /> : null}
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
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/95">
              Markdown · 記事
            </p>
            <p className="text-xs tabular-nums text-slate-500">
              投稿 {formatReviewPublishedForList(review)}
            </p>
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-slate-50 line-clamp-2 group-hover:text-sky-200">
            {titleOne}
          </h2>
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
