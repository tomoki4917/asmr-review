import Link from "next/link";
import { Suspense } from "react";
import { HomeHeroSection } from "@/components/home/HomeHeroSection";
import { HomeReviewList } from "@/components/HomeReviewList";
import { SummaryMarkdown } from "@/components/SummaryMarkdown";
import { HomeSaleColumn } from "@/components/HomeSaleColumn";
import { PsychologyInsightsSection } from "@/components/PsychologyInsightsSection";
import { ReviewCover } from "@/components/ReviewCover";
import { ReviewDlsiteListPrice } from "@/components/ReviewDlsiteListPrice";
import { StarRating } from "@/components/StarRating";
import { ReviewNewBadge } from "@/components/ReviewNewBadge";
import { ShinsakuBadge } from "@/components/ShinsakuBadge";
import { RATING_BEST_DEFAULT, isStarBucketNineOrAbove } from "@/lib/rating-scale";
import {
  getDlsiteProductById,
  isDlsiteProductShinsaku,
  resolveDlsiteSaleDisplay,
} from "@/lib/dlsite-product-catalog";
import { isReviewNewPublication } from "@/lib/review-new-badge";
import { reviewTitleSingleLine } from "@/lib/review-title";
import {
  formatReviewPublishedForList,
  reviewPublicationTimeMs,
} from "@/lib/format-published-at";
import { buildReviewListHref, HOME_REVIEW_LIST_BASE } from "@/lib/review-list-href";
import { getAllReviews, getBeginnerGuides } from "@/lib/reviews";
import type { Review } from "@/lib/types";

/** ピックアップに並べる最大件数（直近・高評価のうち先頭から） */
const SPOTLIGHT_MAX = 1;
const HOME_SIDE_LIST_MAX = 5;
/** すぐ戻せるように: false で従来レイアウトに復帰 */
const ENABLE_HOME_EDITORIAL_LAYOUT = true;
/** 指定時はトップのピックアップをこの slug に固定。`null` で ★9 以上・新しい順に自動 */
const HOME_SPOTLIGHT_SLUG: string | null =
  "beginner-hypnosis-audio-top5-2026";

function pickSpotlightReviews(reviews: Review[]): Review[] {
  if (HOME_SPOTLIGHT_SLUG) {
    const fixed = reviews.find((r) => r.slug === HOME_SPOTLIGHT_SLUG);
    if (fixed) return [fixed];
  }
  const reviewOnly = reviews.filter((r) => r.contentKind === "review");
  return reviewOnly
    .filter((r) =>
      isStarBucketNineOrAbove(r.ratingValue, r.ratingBest ?? RATING_BEST_DEFAULT)
    )
    .sort((a, b) => {
      const tb = reviewPublicationTimeMs(b);
      const ta = reviewPublicationTimeMs(a);
      const diff = tb - ta;
      if (diff !== 0) return diff;
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, SPOTLIGHT_MAX);
}

function SpotlightReviews({ reviews }: { reviews: Review[] }) {
  const items = pickSpotlightReviews(reviews);

  if (items.length === 0) return null;

  return (
    <section
      className="mx-auto mt-14 max-w-5xl px-4 sm:px-0"
      aria-labelledby="spotlight-reviews-heading"
    >
      <h2
        id="spotlight-reviews-heading"
        className="text-center text-lg font-bold tracking-tight text-sky-200 sm:text-xl"
      >
        ピックアップレビュー
      </h2>
      <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-slate-500">
        直近に発売した作品から、★9以上と評価した作品をピックアップしています。
      </p>
      <ul className="mt-6 space-y-4">
        {items.map((r) => {
          const best = r.ratingBest ?? 10;
          const titleOne = reviewTitleSingleLine(r.title);
          const nowSpot = new Date();
          const spotlightNew = isReviewNewPublication(r, nowSpot);
          const spotlightShinsaku = isDlsiteProductShinsaku(
            r.dlsiteProductId
              ? getDlsiteProductById(r.dlsiteProductId)
              : undefined,
            nowSpot
          );
          const spotlightBadges = spotlightNew || spotlightShinsaku;
          return (
            <li key={r.slug}>
              <Link
                href={`/reviews/${r.slug}/`}
                className="group block overflow-hidden rounded-2xl border border-slate-600/45 bg-slate-800/50 shadow-md shadow-slate-950/25 ring-1 ring-sky-900/20 transition hover:-translate-y-0.5 hover:border-sky-500/35 hover:shadow-lg hover:shadow-sky-950/15 hover:ring-sky-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/45"
              >
                <div className="relative">
                  {spotlightBadges ? (
                    <div className="absolute right-3 top-3 z-10 flex max-w-[min(100%,calc(100%-1.5rem))] flex-wrap justify-end gap-1.5">
                      {spotlightNew ? (
                        <ReviewNewBadge variant="overlay" />
                      ) : null}
                      {spotlightShinsaku ? (
                        <ShinsakuBadge variant="overlay" />
                      ) : null}
                    </div>
                  ) : null}
                  <ReviewCover
                    coverImage={r.coverImage}
                    alt={titleOne}
                    slug={r.slug}
                    priority
                    className="rounded-none"
                  />
                </div>
                <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6 sm:py-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/90">
                      {r.contentKind === "article" ? "記事" : "作品レビュー"}
                    </p>
                    <h3 className="mt-1 text-balance text-lg font-bold leading-snug text-slate-50 group-hover:text-sky-200 sm:text-xl">
                      {titleOne}
                    </h3>
                    <div className="mt-2 line-clamp-3 min-h-0 leading-relaxed text-slate-400">
                      <SummaryMarkdown markdown={r.summary} className="text-sm" />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    {r.contentKind === "review" ? (
                      <>
                        <StarRating value={r.ratingValue} best={best} size="md" />
                        <ReviewDlsiteListPrice review={r} />
                      </>
                    ) : null}
                    <span className="text-sm font-semibold text-sky-300 transition group-hover:text-sky-200">
                      {r.contentKind === "article" ? "記事を読む" : "レビューを読む"}
                      <span aria-hidden className="ml-1 inline-block transition group-hover:translate-x-0.5">
                        →
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function latestReviews(reviews: Review[]): Review[] {
  return reviews
    .filter((r) => r.contentKind === "review")
    .sort((a, b) => {
      const tb = reviewPublicationTimeMs(b);
      const ta = reviewPublicationTimeMs(a);
      const diff = tb - ta;
      if (diff !== 0) return diff;
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, HOME_SIDE_LIST_MAX);
}

/** セール中のレビュー（★高い順・同点は割引率→新しい順）。件数制限なし。 */
function allSaleReviews(reviews: Review[]): Review[] {
  return reviews
    .filter((r) => r.contentKind === "review" && r.dlsiteProductId)
    .filter((r) => {
      const product = r.dlsiteProductId
        ? getDlsiteProductById(r.dlsiteProductId)
        : undefined;
      return product
        ? resolveDlsiteSaleDisplay(product).on_sale
        : false;
    })
    .sort((a, b) => {
      const starDiff =
        b.ratingValue - a.ratingValue;
      if (starDiff !== 0) return starDiff;
      const pa = a.dlsiteProductId
        ? getDlsiteProductById(a.dlsiteProductId)
        : undefined;
      const pb = b.dlsiteProductId
        ? getDlsiteProductById(b.dlsiteProductId)
        : undefined;
      const disc =
        (pb ? resolveDlsiteSaleDisplay(pb).discount_rate : 0) -
        (pa ? resolveDlsiteSaleDisplay(pa).discount_rate : 0);
      if (disc !== 0) return disc;
      return reviewPublicationTimeMs(b) - reviewPublicationTimeMs(a);
    });
}

/** 一覧左カラム用（JST 暦日で「今日 / 昨日 / N日前」） */
function publicationRelativeJa(review: Review): string {
  const ms = reviewPublicationTimeMs(review);
  if (!Number.isFinite(ms)) return formatReviewPublishedForList(review);
  const pubDay = new Date(ms).toLocaleDateString("en-CA", {
    timeZone: "Asia/Tokyo",
  });
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  if (pubDay === today) return "今日";
  const y = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  );
  y.setDate(y.getDate() - 1);
  const yesterday = y.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  if (pubDay === yesterday) return "昨日";
  const pubNoon = new Date(`${pubDay}T12:00:00+09:00`).getTime();
  const todayNoon = new Date(`${today}T12:00:00+09:00`).getTime();
  const diffDays = Math.floor((todayNoon - pubNoon) / 86400000);
  if (diffDays >= 2 && diffDays < 7) return `${diffDays}日前`;
  return formatReviewPublishedForList(review);
}

function HomeEditorialColumns({ reviews }: { reviews: Review[] }) {
  const spotlight = pickSpotlightReviews(reviews)[0];
  const latest = latestReviews(reviews);
  const onSaleAll = allSaleReviews(reviews);

  if (!spotlight) return null;

  const nowSpot = new Date();
  const spotlightNew = isReviewNewPublication(spotlight, nowSpot);
  const spotlightShinsaku = isDlsiteProductShinsaku(
    spotlight.dlsiteProductId
      ? getDlsiteProductById(spotlight.dlsiteProductId)
      : undefined,
    nowSpot
  );
  const spotlightBadges = spotlightNew || spotlightShinsaku;

  return (
    <section
      className="mx-auto mt-12 max-w-7xl border-t border-slate-600/50 px-4 pt-10 sm:mt-14 sm:px-0"
      aria-label="注目エリア"
    >
      <div className="grid items-start gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.55fr)_minmax(0,1fr)] lg:gap-x-10">
        <aside className="min-w-0">
          <header className="border-t border-slate-500/70 pt-3">
            <h2 className="font-serif text-xl font-bold tracking-tight text-slate-50 sm:text-[1.35rem]">
              <Link
                href={buildReviewListHref(HOME_REVIEW_LIST_BASE, { sort: "new" })}
                className="transition hover:text-sky-200"
              >
                新着
              </Link>
            </h2>
          </header>
          <ul className="mt-5 space-y-5">
            {latest.map((r) => {
              const titleOne = reviewTitleSingleLine(r.title);
              return (
                <li key={r.slug}>
                  <Link href={`/reviews/${r.slug}/`} className="group flex gap-3">
                    <div className="w-[4.5rem] shrink-0 sm:w-20">
                      <ReviewCover
                        coverImage={r.coverImage}
                        alt={titleOne}
                        slug={r.slug}
                        className="rounded-md"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-pretty text-sm font-semibold leading-snug text-slate-100 group-hover:text-sky-300">
                        {titleOne}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {publicationRelativeJa(r)}
                      </p>
                      <div className="mt-1.5 min-w-0">
                        <ReviewDlsiteListPrice review={r} size="compact" />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

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
              {spotlightBadges ? (
                <div className="absolute right-3 top-3 z-10 flex max-w-[min(100%,calc(100%-1.5rem))] flex-wrap justify-end gap-1.5">
                  {spotlightNew ? <ReviewNewBadge variant="overlay" /> : null}
                  {spotlightShinsaku ? (
                    <ShinsakuBadge variant="overlay" />
                  ) : null}
                </div>
              ) : null}
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
              <SummaryMarkdown markdown={spotlight.summary} className="text-sm sm:text-[0.9375rem]" />
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

        <aside className="min-w-0">
          <header className="border-t border-slate-500/70 pt-3">
            <h2 className="font-serif text-xl font-bold tracking-tight text-slate-50 sm:text-[1.35rem]">
              <Link
                href={buildReviewListHref(HOME_REVIEW_LIST_BASE, { sale: true })}
                className="transition hover:text-sky-200"
              >
                セール中
              </Link>
            </h2>
          </header>
          <p className="mt-2 text-pretty text-xs leading-relaxed text-slate-500">
            解析室で紹介した作品のうち、いま値下げ中のものです。
          </p>
          <HomeSaleColumn reviews={onSaleAll} previewMax={HOME_SIDE_LIST_MAX} />
        </aside>
      </div>
    </section>
  );
}

export default function HomePage() {
  const reviews = getAllReviews();
  const beginnerGuides = getBeginnerGuides();

  return (
    <main className="mx-auto w-full max-w-7xl py-10 sm:py-14">
      <HomeHeroSection />

      {ENABLE_HOME_EDITORIAL_LAYOUT ? (
        <HomeEditorialColumns reviews={reviews} />
      ) : (
        <SpotlightReviews reviews={reviews} />
      )}

      <Suspense
        fallback={
          <p className="mt-14 text-center text-sm text-slate-500">
            一覧を読み込んでいます…
          </p>
        }
      >
        <HomeReviewList markdownReviews={reviews} />
      </Suspense>

      <PsychologyInsightsSection beginnerGuides={beginnerGuides} />
    </main>
  );
}
