import Link from "next/link";
import { DlsiteRankingSidebar } from "@/components/dlsite/DlsiteRankingSidebar";
import { SummaryMarkdown } from "@/components/SummaryMarkdown";
import { ReviewCover } from "@/components/ReviewCover";
import { ReviewDlsiteListPrice } from "@/components/ReviewDlsiteListPrice";
import { StarRating } from "@/components/StarRating";
import { ReviewOverlayBadges } from "@/components/ReviewOverlayBadges";
import { isReviewNewPublication } from "@/lib/review-new-badge";
import { reviewTitleSingleLine } from "@/lib/review-title";
import { reviewPublicationTimeMs } from "@/lib/format-published-at";
import { RATING_BEST_DEFAULT, isStarBucketNineOrAbove } from "@/lib/rating-scale";
import type { Review } from "@/lib/types";

/** 全年齢トップのピックアップ固定 slug（`null` で ★9 以上・新しい順） */
const ALL_AGES_SPOTLIGHT_SLUG: string | null =
  "shinitagari-junai-maid-yogarekake";

function pickSpotlight(reviews: Review[]): Review | undefined {
  if (ALL_AGES_SPOTLIGHT_SLUG) {
    return reviews.find((r) => r.slug === ALL_AGES_SPOTLIGHT_SLUG);
  }
  return reviews
    .filter((r) => r.contentKind === "review")
    .filter((r) =>
      isStarBucketNineOrAbove(r.ratingValue, r.ratingBest ?? RATING_BEST_DEFAULT)
    )
    .sort((a, b) => reviewPublicationTimeMs(b) - reviewPublicationTimeMs(a))[0];
}

type Props = {
  reviews: Review[];
};

/** 全年齢トップ：新着／ピックアップ（2 カラム） */
export function AllAgesHomeEditorial({ reviews }: Props) {
  const spotlight = pickSpotlight(reviews);
  if (!spotlight) return null;

  const now = new Date();
  const spotlightNew = isReviewNewPublication(spotlight, now);

  return (
    <section
      className="mx-auto mt-12 max-w-7xl border-t border-slate-600/50 px-4 pt-10 sm:mt-14 sm:px-0"
      aria-label="注目エリア"
    >
      <div className="grid items-start gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.55fr)] lg:gap-x-10">
        <DlsiteRankingSidebar site="home" count={5} />

        <article
          className="min-w-0 lg:px-1"
          aria-labelledby="home-pickup-review-heading"
        >
          <header className="border-t border-slate-500/70 pt-3">
            <h2
              id="home-pickup-review-heading"
              className="font-serif text-xl font-bold tracking-tight text-slate-50 sm:text-[1.35rem]"
            >
              ピックアップレビュー
            </h2>
          </header>
          <Link
            href={`/reviews/${spotlight.slug}/`}
            className="group mt-5 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/45"
          >
            <div className="relative overflow-hidden bg-slate-900">
              <ReviewOverlayBadges
                review={spotlight}
                showNew={spotlightNew}
              />
              <ReviewCover
                coverImage={spotlight.coverImage}
                alt={reviewTitleSingleLine(spotlight.title)}
                slug={spotlight.slug}
                priority
                variant="hero"
                className="rounded-none"
              />
            </div>
            <h3 className="mt-5 text-pretty font-serif text-2xl font-bold leading-[1.2] tracking-tight text-slate-50 group-hover:text-sky-200 sm:text-3xl lg:text-[1.85rem] xl:text-4xl">
              {reviewTitleSingleLine(spotlight.title)}
            </h3>
            <div className="mt-3 line-clamp-3 min-h-0 leading-relaxed text-slate-400">
              <SummaryMarkdown
                markdown={spotlight.summary}
                className="text-sm sm:text-[0.9375rem]"
              />
            </div>
            {spotlight.contentKind === "review" ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <StarRating
                  value={spotlight.ratingValue}
                  best={spotlight.ratingBest ?? 10}
                  size="md"
                />
                <ReviewDlsiteListPrice review={spotlight} />
              </div>
            ) : null}
          </Link>
        </article>
      </div>
    </section>
  );
}
