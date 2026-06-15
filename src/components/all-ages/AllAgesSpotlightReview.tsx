import Link from "next/link";
import { SummaryMarkdown } from "@/components/SummaryMarkdown";
import { ReviewCover } from "@/components/ReviewCover";
import { ReviewDlsiteListPrice } from "@/components/ReviewDlsiteListPrice";
import { StarRating } from "@/components/StarRating";
import { ReviewOverlayBadges } from "@/components/ReviewOverlayBadges";
import { pickAllAgesSpotlight } from "@/lib/all-ages-spotlight";
import { isReviewNewPublication } from "@/lib/review-new-badge";
import { reviewTitleSingleLine } from "@/lib/review-title";
import type { Review } from "@/lib/types";

type Props = {
  reviews: Review[];
  className?: string;
  headingId?: string;
};

/** 全年齢ピックアップレビュー1件（トップ・YouTube 案内で共通） */
export function AllAgesSpotlightReview({
  reviews,
  className = "",
  headingId = "home-pickup-review-heading",
}: Props) {
  const spotlight = pickAllAgesSpotlight(reviews);
  if (!spotlight) return null;

  const spotlightNew = isReviewNewPublication(spotlight, new Date());

  return (
    <article
      className={`min-w-0 ${className}`.trim()}
      aria-labelledby={headingId}
    >
      <header className="border-t border-slate-500/70 pt-3">
        <h2
          id={headingId}
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
          <ReviewOverlayBadges review={spotlight} showNew={spotlightNew} />
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
  );
}
