import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AffiliateButton, AffiliateButtonGroup } from "@/components/AffiliateButton";
import { MatureContentNotice } from "@/components/MatureContentNotice";
import { ReviewCover } from "@/components/ReviewCover";
import { ReviewJsonLd } from "@/components/ReviewJsonLd";
import { ArticleNextNav } from "@/components/ArticleNextNav";
import { ReviewMarkdown } from "@/components/ReviewMarkdown";
import { SummaryMarkdown } from "@/components/SummaryMarkdown";
import { StarRating } from "@/components/StarRating";
import { ReviewNewBadge } from "@/components/ReviewNewBadge";
import { ShinsakuBadge } from "@/components/ShinsakuBadge";
import { DlsitePricePanel } from "@/components/DlsitePricePanel";
import { resolveSocialPreviewImage, siteUrl } from "@/lib/og-metadata";
import { isReviewNewPublication } from "@/lib/review-new-badge";
import {
  articlePublishedTimeIso,
  effectiveDisplayPublishedIsoDate,
  formatPublishedAtForList,
} from "@/lib/format-published-at";
import {
  getAllSlugs,
  getReviewBySlug,
  isReviewVisibleOnSite,
} from "@/lib/reviews";
import {
  splitBeforeAtRecommendedAudience,
  splitBodyAtFinalRating,
  splitRatingAtWorkIntroLabel,
  splitRestAfterWorkImpression,
} from "@/lib/split-review-body";
import { reviewTitleSingleLine } from "@/lib/review-title";
import { stripMarkdownForMeta } from "@/lib/strip-markdown-lite";
import {
  getDlsiteProductById,
  isDlsiteProductShinsaku,
} from "@/lib/dlsite-product-catalog";
import { resolveDlsiteAffiliateHref } from "@/lib/resolve-dlsite-affiliate-href";
import type { AffiliateLink } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

function formatGoLiveForReader(goLiveAt: string): string {
  const s = goLiveAt.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const iso = dateOnly.test(s) ? `${s}T00:00:00.000Z` : s;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return s;
  return new Date(t).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 文頭サマリー横。先頭リンクのラベルを作品ページ導線に統一 */
function affiliateLinksHeader(links: AffiliateLink[]): AffiliateLink[] {
  return links.map((l, i) =>
    i === 0 ? { ...l, label: "作品ページはこちら" } : l
  );
}

/** 「総合評価」横ボタン用。先頭リンクのラベルを体験版導線に統一 */
function affiliateLinksBesideRating(links: AffiliateLink[]): AffiliateLink[] {
  return links.map((l, i) =>
    i === 0 ? { ...l, label: "体験版はこちら" } : l
  );
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const review = getReviewBySlug(slug);
  if (!review) return { title: "見つかりません" };

  const title = reviewTitleSingleLine(review.title);
  const now = new Date();
  if (!isReviewVisibleOnSite(review, now)) {
    return {
      title: `${title}（公開予定）`,
      description: "このページは予約公開前です。",
      robots: { index: false, follow: false },
    };
  }

  const publishedTimeIso = articlePublishedTimeIso(review);
  const description =
    stripMarkdownForMeta(review.summary) || title;
  const url = `${siteUrl()}/reviews/${slug}/`;
  const { url: imageUrl, alt: imageAlt } = resolveSocialPreviewImage(review);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: publishedTimeIso,
      images: [{ url: imageUrl, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    alternates: { canonical: url },
  };
}

export default async function ReviewPage({ params }: Props) {
  const { slug } = await params;
  const review = getReviewBySlug(slug);
  if (!review) notFound();

  const now = new Date();
  if (!isReviewVisibleOnSite(review, now)) {
    const titleOne = reviewTitleSingleLine(review.title);
    const when = review.goLiveAt?.trim()
      ? formatGoLiveForReader(review.goLiveAt)
      : "予定時刻が設定されていません";
    return (
      <article className="mx-auto w-full min-w-0 max-w-3xl py-8 sm:py-10 lg:max-w-4xl xl:max-w-5xl xl:py-11">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 transition hover:text-sky-200"
        >
          <span aria-hidden>←</span> トップへ
        </Link>
        <header className="mt-8 rounded-3xl border border-amber-700/35 bg-slate-800/60 px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
            予約公開
          </p>
          <h1 className="mt-2 text-xl font-bold leading-snug text-slate-50 sm:text-2xl">
            {titleOne}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            このレビューはまだ公開開始前です。本文は公開日時以降に表示されます。
          </p>
          <p className="mt-3 text-sm tabular-nums text-slate-300">
            公開予定（目安）：{when}
          </p>
          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            本番（静的エクスポート）では<strong>ビルドを実行した瞬間</strong>が公開判定に使われます。予約時刻のあとに本番ビルドが走るまで本文は出ません（サーバーが時刻で切り替える方式ではありません）。日次は GitHub
            Actions が概ね JST 21:05・22:00 に Vercel へ再デプロイをかける想定です。出ないときは Actions の成否と、リポジトリの{" "}
            <code className="rounded bg-slate-900/80 px-1">VERCEL_DEPLOY_HOOK_URL</code>{" "}
            設定を確認してください。
          </p>
        </header>
      </article>
    );
  }

  const displayPublishedIso = effectiveDisplayPublishedIsoDate(
    review.publishedAt,
    review.goLiveAt
  );
  const displayPublishedLabel =
    formatPublishedAtForList(displayPublishedIso);

  const canonicalUrl = `${siteUrl()}/reviews/${review.slug}/`;
  const best = review.ratingBest ?? 10;

  const isArticle = review.contentKind === "article";
  const titleHasBreak = review.title.includes("\n");
  const nextReview = review.nextSlug
    ? getReviewBySlug(review.nextSlug)
    : undefined;

  const dlsiteProduct =
    !isArticle && review.dlsiteProductId != null
      ? getDlsiteProductById(review.dlsiteProductId)
      : undefined;

  const nowBadges = new Date();
  const showNewBadge = isReviewNewPublication(review, nowBadges);
  const showShinsakuBadge =
    !isArticle && isDlsiteProductShinsaku(dlsiteProduct, nowBadges);
  const showHeaderBadges = showNewBadge || showShinsakuBadge;

  const coverEl = (
    <ReviewCover
      coverImage={review.coverImage}
      alt={reviewTitleSingleLine(review.title)}
      slug={review.slug}
      priority
      variant="hero"
      className="rounded-none"
    />
  );

  const hasAffiliateContent =
    review.affiliateLinks.length > 0 || Boolean(review.coverAffiliateHref);

  const finalRatingSplit = review.body
    ? splitBodyAtFinalRating(review.body)
    : null;
  const restWorkSplit =
    finalRatingSplit?.rest != null
      ? splitRestAfterWorkImpression(finalRatingSplit.rest)
      : null;
  const ratingParts = finalRatingSplit?.rating
    ? splitRatingAtWorkIntroLabel(finalRatingSplit.rating)
    : { core: "", workIntro: "" };
  const recommendedAudienceSplit =
    !isArticle && finalRatingSplit?.before
      ? splitBeforeAtRecommendedAudience(finalRatingSplit.before)
      : null;
  const showAffiliateBesideRating =
    Boolean(finalRatingSplit) && review.affiliateLinks.length > 0;

  return (
    <>
      {!isArticle && (
        <ReviewJsonLd
          review={review}
          canonicalUrl={canonicalUrl}
          dlsiteProduct={dlsiteProduct}
        />
      )}
      <article
        className={`mx-auto w-full min-w-0 max-w-3xl py-8 sm:py-10 lg:max-w-4xl xl:max-w-5xl xl:py-11 ${isArticle ? "article-reading" : "review-reading"}`}
      >
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 transition hover:text-sky-200"
        >
          <span aria-hidden>←</span> {isArticle ? "トップへ" : "レビュー一覧"}
        </Link>

        {!isArticle ? (
          <MatureContentNotice context="review" className="mt-5 sm:mt-6" />
        ) : null}

        <header className="mt-5 sm:mt-6">
          <div className="overflow-hidden rounded-3xl border border-slate-600/45 bg-slate-800/50 shadow-lg shadow-slate-950/25 backdrop-blur-sm">
            {review.coverAffiliateHref ? (
              <a
                href={review.coverAffiliateHref}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                className="block rounded-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/50"
                aria-label={`${review.itemName}の作品ページを開く`}
              >
                {coverEl}
              </a>
            ) : (
              coverEl
            )}
            <div
              className={`border-t border-slate-600/40 bg-slate-900/50 py-6 sm:px-8 sm:py-8 ${
                isArticle
                  ? "px-5 max-sm:px-5 max-sm:pb-7 max-sm:pt-6"
                  : "px-4"
              }`}
            >
              <div
                className={`flex flex-wrap items-start gap-2 sm:gap-3 ${showHeaderBadges ? "items-center" : ""}`}
              >
                {showHeaderBadges ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {showNewBadge ? (
                      <ReviewNewBadge className="mt-0.5 sm:mt-1" />
                    ) : null}
                    {showShinsakuBadge ? (
                      <ShinsakuBadge variant="inline" className="mt-0.5 sm:mt-1" />
                    ) : null}
                  </div>
                ) : null}
                <h1
                  className={`min-w-0 flex-1 text-2xl font-bold leading-tight tracking-tight text-slate-50 sm:text-3xl ${isArticle || titleHasBreak ? "whitespace-pre-line text-pretty" : "text-balance"} ${isArticle ? "max-sm:text-[1.7rem] max-sm:leading-snug" : ""}`}
                >
                  {review.title}
                </h1>
              </div>
              <div
                className={`mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 ${!isArticle ? "sm:justify-between" : ""}`}
              >
                {!isArticle && (
                  <StarRating value={review.ratingValue} best={best} size="md" />
                )}
                <p
                  className={`text-sm text-slate-500 ${isArticle ? "sm:ml-auto" : ""}`}
                >
                  <time dateTime={displayPublishedIso}>
                    {displayPublishedLabel}
                  </time>
                  <span className="mx-2 text-slate-600">·</span>
                  <span>{review.authorName}</span>
                </p>
              </div>
              <ul className="mt-5 flex flex-wrap gap-2">
                {review.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-lg border border-sky-800/35 bg-sky-950/30 px-3 py-1 text-xs font-semibold text-sky-200/90"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
              <div
                className={`mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6 ${
                  review.affiliateLinks.length > 0 ? "sm:justify-between" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <SummaryMarkdown markdown={review.summary} />
                </div>
                {review.affiliateLinks.length > 0 ? (
                  <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:max-w-[min(100%,18rem)] sm:pt-0.5">
                    {review.affiliateLinks.length === 1 ? (
                      <AffiliateButton
                        link={affiliateLinksHeader(review.affiliateLinks)[0]}
                        className="min-h-11 w-full px-5 py-2.5 text-sm sm:min-w-[12rem]"
                      />
                    ) : (
                      <AffiliateButtonGroup
                        links={affiliateLinksHeader(review.affiliateLinks)}
                        className="w-full flex-col sm:w-auto"
                      />
                    )}
                  </div>
                ) : null}
              </div>
              {dlsiteProduct ? (
                <div className="mt-5 border-t border-slate-700/30 pt-5">
                  <DlsitePricePanel
                    product={dlsiteProduct}
                    affiliateHref={resolveDlsiteAffiliateHref(review)}
                  />
                </div>
              ) : null}
              {hasAffiliateContent ? (
                <p
                  className="mt-4 border-t border-slate-700/25 pt-3 text-[11px] leading-relaxed text-slate-600 sm:text-xs"
                  role="note"
                >
                  ※本ページには紹介用のリンクが含まれる場合があります。成果が生じた際、当サイトに紹介料が入ることがあります。
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <section
          className={`mt-8 min-w-0 rounded-3xl border border-slate-600/45 bg-slate-800/50 shadow-md shadow-slate-950/20 backdrop-blur-sm sm:mt-9 sm:px-8 sm:py-9 ${isArticle ? "px-5 py-8 max-sm:py-8" : "px-4 py-7"}`}
        >
          {!review.body ? (
            <p className="text-slate-500">本文がまだありません。</p>
          ) : finalRatingSplit ? (
            <>
              {recommendedAudienceSplit ? (
                <>
                  {recommendedAudienceSplit.prefix.trim() ? (
                    <ReviewMarkdown
                      markdown={recommendedAudienceSplit.prefix}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                    />
                  ) : null}
                  <div
                    className={`review-recommended-panel flow-root rounded-2xl border border-sky-500/25 bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-sky-950/25 px-4 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] ring-1 ring-sky-500/10 sm:px-6 sm:py-6 ${
                      recommendedAudienceSplit.prefix.trim()
                        ? "mt-8 sm:mt-9"
                        : ""
                    }`}
                    aria-labelledby="recommended-audience"
                  >
                    <ReviewMarkdown
                      markdown={recommendedAudienceSplit.audience}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                      recommendedAudienceHeading
                    />
                  </div>
                </>
              ) : finalRatingSplit.before.trim() ? (
                <ReviewMarkdown
                  markdown={finalRatingSplit.before}
                  articleReading={isArticle}
                  starReviewReadingComfort={!isArticle}
                  workImpressionAvatar={review.workImpressionAvatar}
                />
              ) : null}
              <div className="mt-10 border-t border-slate-700/50 pt-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                  <div className="min-w-0 flex-1">
                    <h2
                      id="final-rating-heading"
                      className="mb-3 scroll-mt-24 text-xl font-bold tracking-tight text-slate-50"
                    >
                      総合評価
                    </h2>
                    <ReviewMarkdown
                      markdown={ratingParts.core}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                    />
                  </div>
                  {review.affiliateLinks.length > 0 ? (
                    <div className="w-full shrink-0 sm:w-auto sm:max-w-[min(100%,20rem)] sm:pt-1">
                      <AffiliateButtonGroup
                        links={affiliateLinksBesideRating(review.affiliateLinks)}
                        className="w-full sm:w-auto"
                      />
                    </div>
                  ) : null}
                </div>
                {ratingParts.workIntro.trim() ? (
                  <div className="mt-6 min-w-0 sm:mt-8">
                    <ReviewMarkdown
                      markdown={ratingParts.workIntro}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                    />
                  </div>
                ) : null}
              </div>
              {finalRatingSplit.rest.trim() ? (
                <div className="mt-10 min-w-0 border-t border-slate-700/50 pt-8">
                  {restWorkSplit && review.affiliateLinks.length > 0 ? (
                    <>
                      <ReviewMarkdown
                        markdown={restWorkSplit.before}
                        articleReading={isArticle}
                        starReviewReadingComfort={!isArticle}
                        workImpressionAvatar={review.workImpressionAvatar}
                      />
                      <div className="mt-8 flex justify-center sm:justify-start">
                        <AffiliateButton
                          link={{
                            ...review.affiliateLinks[0],
                            label: "購入はこちら",
                          }}
                          className="w-full min-h-[3.25rem] sm:w-auto sm:min-w-[14rem]"
                        />
                      </div>
                      {restWorkSplit.after.trim() ? (
                        <div className="mt-10 min-w-0">
                          <ReviewMarkdown
                            markdown={restWorkSplit.after}
                            articleReading={isArticle}
                            starReviewReadingComfort={!isArticle}
                            workImpressionAvatar={review.workImpressionAvatar}
                          />
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <ReviewMarkdown
                      markdown={finalRatingSplit.rest}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                    />
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <ReviewMarkdown
              markdown={review.body}
              articleReading={isArticle}
              starReviewReadingComfort={!isArticle}
              workImpressionAvatar={review.workImpressionAvatar}
            />
          )}
        </section>

        {nextReview ? <ArticleNextNav next={nextReview} /> : null}

        {review.affiliateLinks.length > 0 &&
          !showAffiliateBesideRating &&
          review.summary.trim() === "" && (
            <section className="mt-8 rounded-3xl border border-slate-600/40 bg-slate-800/40 px-5 py-7 sm:mt-9 sm:px-8 sm:py-8">
              <h2 className="text-lg font-bold text-slate-50">
                作品のページへ
              </h2>
              <AffiliateButtonGroup links={review.affiliateLinks} className="mt-5" />
            </section>
          )}
      </article>
    </>
  );
}
