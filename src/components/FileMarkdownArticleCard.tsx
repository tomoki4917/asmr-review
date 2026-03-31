import Link from "next/link";
import type { Review } from "@/lib/types";
import { ReviewCover } from "./ReviewCover";

type Props = {
  review: Review;
  priorityImage?: boolean;
};

/** `contentKind: article` の Markdown 記事用カード（星なし） */
export function FileMarkdownArticleCard({
  review,
  priorityImage = false,
}: Props) {
  return (
    <article>
      <Link
        href={`/reviews/${review.slug}`}
        className="group block min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-600/40 bg-slate-800/50 shadow-md shadow-slate-950/20 ring-1 ring-slate-700/30 transition hover:-translate-y-0.5 hover:border-sky-500/35 hover:shadow-lg hover:shadow-sky-950/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/45"
      >
        <ReviewCover
          coverImage={review.coverImage}
          alt={review.title}
          slug={review.slug}
          priority={priorityImage}
          className="rounded-t-3xl group-focus-visible:rounded-t-3xl"
        />
        <div className="p-5 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/95">
            Markdown · 記事
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-slate-50 line-clamp-2 group-hover:text-sky-200">
            {review.title}
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
