import Link from "next/link";
import { Suspense } from "react";
import { DevSiteNextReviewList } from "@/components/dev/DevSiteNextReviewList";
import { ReviewCover } from "@/components/ReviewCover";
import { reviewPublicationTimeMs } from "@/lib/format-published-at";
import { RATING_BEST_DEFAULT, isStarBucketNineOrAbove } from "@/lib/rating-scale";
import { reviewTitleSingleLine } from "@/lib/review-title";
import {
  buildReviewListHref,
  DEV_SITE_NEXT_LIST_BASE,
} from "@/lib/review-list-href";
import { SITE_NEXT_CATEGORY_GRID } from "@/lib/site-next-draft-links";
import type { Review } from "@/lib/types";

const SPOTLIGHT_SLUG = "unknown-hypno-daijobu-koe-ni-yudanete";

type Props = {
  reviews: Review[];
};

function pickSpotlight(reviews: Review[]): Review | undefined {
  const reviewOnly = reviews.filter((r) => r.contentKind === "review");
  const fixed = reviewOnly.find((r) => r.slug === SPOTLIGHT_SLUG);
  if (fixed) return fixed;
  return reviewOnly
    .filter((r) =>
      isStarBucketNineOrAbove(r.ratingValue, r.ratingBest ?? RATING_BEST_DEFAULT)
    )
    .sort((a, b) => reviewPublicationTimeMs(b) - reviewPublicationTimeMs(a))[0];
}

function pickLatest(reviews: Review[]): Review | undefined {
  return reviews
    .filter((r) => r.contentKind === "review")
    .sort((a, b) => reviewPublicationTimeMs(b) - reviewPublicationTimeMs(a))[0];
}

function ReviewTeaserCard({
  label,
  review,
  listHref,
}: {
  label: string;
  review: Review | undefined;
  /** カード全体のリンク先（省略時はレビュー詳細） */
  listHref?: string;
}) {
  const detailHref = review ? `/reviews/${review.slug}/` : undefined;
  const cardHref = listHref ?? detailHref;

  return (
    <article className="flex min-h-[10.5rem] flex-col rounded-xl border border-slate-600/50 bg-slate-800/35 p-3.5 shadow-md shadow-slate-950/20 ring-1 ring-white/[0.04] sm:min-h-[11.5rem] sm:p-4">
      <h2 className="text-center text-sm font-bold tracking-wide text-slate-200">
        {cardHref ? (
          <Link href={cardHref} className="hover:text-sky-200">
            {label}
          </Link>
        ) : (
          label
        )}
      </h2>
      {review ? (
        <Link
          href={cardHref ?? detailHref!}
          className="group mt-3 flex min-h-0 flex-1 flex-col"
        >
          <div className="mx-auto w-full max-w-[7.25rem] sm:max-w-[8rem]">
            <ReviewCover
              coverImage={review.coverImage}
              alt={reviewTitleSingleLine(review.title)}
              slug={review.slug}
              className="rounded-md"
            />
          </div>
          <p className="mt-2.5 line-clamp-3 text-center text-xs font-semibold leading-snug text-slate-100 group-hover:text-sky-200 sm:text-[13px]">
            {reviewTitleSingleLine(review.title)}
          </p>
        </Link>
      ) : (
        <p className="mt-5 flex flex-1 items-center justify-center text-center text-sm text-slate-500">
          表示するレビューがありません
        </p>
      )}
    </article>
  );
}

/**
 * 開発用 `/dev/site-next/` — ワイヤーフォーム準拠（ヘッダーは `DevSiteNextHeader`）。
 * ピックアップ／新着の2枠 → 3×3カテゴリ → 全て見る。
 */
export function DevSiteNextMyBestStyleSection({ reviews }: Props) {
  const spotlight = pickSpotlight(reviews);
  const latest = pickLatest(reviews);

  return (
    <section className="mx-auto w-full max-w-lg px-3 pb-10 pt-5 sm:max-w-xl sm:px-4" aria-label="次サイト草案メイン">
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
        <ReviewTeaserCard label="ピックアップレビュー" review={spotlight} />
        <ReviewTeaserCard
          label="新着レビュー"
          review={latest}
          listHref={buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { sort: "new" })}
        />
      </div>

      <nav
        className="mt-6 rounded-2xl border border-slate-600/45 bg-slate-800/40 p-4 shadow-md shadow-slate-950/25 ring-1 ring-white/5"
        aria-label="カテゴリから移動"
      >
        <ul className="grid auto-rows-fr grid-cols-3 gap-x-2 gap-y-6 px-0.5 sm:gap-x-3 sm:gap-y-7">
          {SITE_NEXT_CATEGORY_GRID.map(({ emoji, title, href, mobileTitleLines }) => (
            <li key={href + title} className="flex min-w-0">
              <Link
                href={href}
                className="group flex h-full min-h-[6.75rem] w-full flex-col items-center justify-start gap-2 rounded-xl px-1 py-2.5 text-center transition hover:bg-slate-700/35 active:bg-slate-700/50"
              >
                <span
                  className="flex h-14 w-14 shrink-0 select-none items-center justify-center rounded-2xl border border-slate-600/40 bg-slate-900/45 text-[1.65rem] leading-none shadow-md shadow-slate-950/35 transition group-hover:border-sky-500/35 group-hover:bg-slate-900/65 sm:h-16 sm:w-16 sm:text-[1.95rem]"
                  aria-hidden
                >
                  {emoji}
                </span>
                <span className="flex min-h-[2.35rem] w-full flex-col items-center justify-center text-[10px] font-semibold leading-tight text-slate-200 group-hover:text-sky-200 sm:min-h-[2.5rem] sm:text-[11px]">
                  {mobileTitleLines ? (
                    mobileTitleLines.map((line) => <span key={line}>{line}</span>)
                  ) : (
                    <span className="leading-snug">{title}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href={buildReviewListHref(DEV_SITE_NEXT_LIST_BASE, { sort: "new" })}
          className="mt-6 flex w-full items-center justify-center rounded-xl border border-slate-600/45 bg-slate-900/30 py-3.5 text-sm font-medium text-slate-200 shadow-sm shadow-slate-950/20 transition hover:border-sky-500/30 hover:bg-slate-800/70 hover:text-sky-100"
        >
          全て見る
        </Link>
      </nav>

      <div className="mt-6 border-t border-slate-600/35 pt-6">
        <Suspense
          fallback={
            <p className="text-center text-sm text-slate-500">一覧を読み込んでいます…</p>
          }
        >
          <DevSiteNextReviewList markdownReviews={reviews} />
        </Suspense>
      </div>
    </section>
  );
}
