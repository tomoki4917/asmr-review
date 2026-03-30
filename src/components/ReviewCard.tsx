import Link from "next/link";
import type { Review } from "@/lib/types";
import { ReviewCover } from "./ReviewCover";
import { StarRating } from "./StarRating";

type Props = {
  review: Review;
  priorityImage?: boolean;
};

export function ReviewCard({ review, priorityImage = false }: Props) {
  const best = review.ratingBest ?? 5;

  return (
    <article>
      <Link
        href={`/reviews/${review.slug}`}
        className="group block min-w-0 max-w-full overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm ring-1 ring-stone-950/[0.04] transition hover:-translate-y-0.5 hover:border-indigo-200/80 hover:shadow-lg hover:shadow-indigo-950/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-stone-800 dark:bg-stone-900 dark:ring-white/[0.06] dark:hover:border-indigo-500/40 dark:hover:shadow-indigo-950/30"
      >
        <ReviewCover
          coverImage={review.coverImage}
          alt={review.title}
          slug={review.slug}
          priority={priorityImage}
          className="rounded-t-3xl group-focus-visible:rounded-t-3xl"
        />
        <div className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold leading-snug tracking-tight text-stone-900 line-clamp-2 group-hover:text-indigo-800 dark:text-stone-50 dark:group-hover:text-indigo-200">
            {review.title}
          </h2>
          <div className="mt-3">
            <StarRating value={review.ratingValue} best={best} size="sm" />
          </div>
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
