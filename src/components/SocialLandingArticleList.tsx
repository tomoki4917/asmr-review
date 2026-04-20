import Image from "next/image";
import Link from "next/link";
import { reviewTitleSingleLine } from "@/lib/review-title";
import { stripMarkdownForMeta } from "@/lib/strip-markdown-lite";
import type { Review } from "@/lib/types";

type Props = {
  reviews: Review[];
};

/** SNS 流入ページの「一般向け」一覧。`safeForExternalLanding` のみ並ぶため年齢確認は挟まない */
export function SocialLandingArticleList({ reviews }: Props) {
  return (
    <ul className="mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5">
      {reviews.map((review, i) => {
        const href = `/reviews/${review.slug}/`;
        const teaser = stripMarkdownForMeta(review.summary);
        const plain =
          teaser.length > 160 ? `${teaser.slice(0, 157)}…` : teaser;
        const titleLine = reviewTitleSingleLine(review.title);

        return (
          <li key={review.slug} className="min-w-0">
            <Link
              href={href}
              className="group flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-600/45 bg-slate-800/50 text-left shadow-md shadow-slate-950/25 ring-1 ring-slate-700/25 transition hover:-translate-y-0.5 hover:border-sky-500/40 hover:ring-sky-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/50"
            >
              <div className="relative flex w-full shrink-0 items-center justify-center overflow-hidden border-b border-slate-600/35 bg-slate-900 aspect-[16/10]">
                {review.coverImage ? (
                  <Image
                    src={review.coverImage}
                    alt={titleLine}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 640px) 100vw, 50vw"
                    priority={i < 2}
                  />
                ) : (
                  <span className="text-xs text-slate-500">No image</span>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
                <h2 className="text-sm font-bold leading-snug tracking-tight text-slate-50 group-hover:text-sky-100 sm:text-base">
                  {titleLine}
                </h2>
                <p className="jp-prose-plain mt-2 line-clamp-3 flex-1 text-xs leading-relaxed text-slate-400 sm:text-sm">
                  {plain}
                </p>
                <p className="mt-3 text-xs font-semibold text-sky-300 transition group-hover:text-sky-200 sm:text-sm">
                  記事を読む
                  <span
                    aria-hidden
                    className="ml-0.5 inline-block transition group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
