import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdMaxUnit } from "@/components/AdMaxUnit";
import { AffiliateButtonGroup } from "@/components/AffiliateButton";
import { ReviewCover } from "@/components/ReviewCover";
import { ReviewJsonLd } from "@/components/ReviewJsonLd";
import { ArticleNextNav } from "@/components/ArticleNextNav";
import { ReviewMarkdown } from "@/components/ReviewMarkdown";
import { SummaryMarkdown } from "@/components/SummaryMarkdown";
import { StarRating } from "@/components/StarRating";
import { resolveSocialPreviewImage, siteUrl } from "@/lib/og-metadata";
import { getAllSlugs, getReviewBySlug } from "@/lib/reviews";
import { splitBodyAtFinalRating } from "@/lib/split-review-body";
import { stripMarkdownForMeta } from "@/lib/strip-markdown-lite";
import type { AffiliateLink } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

/** 「総合評価」横ボタン用。先頭リンクのラベルを作品ページ導線に統一 */
function affiliateLinksBesideRating(links: AffiliateLink[]): AffiliateLink[] {
  return links.map((l, i) =>
    i === 0 ? { ...l, label: "作品ページはこちら" } : l
  );
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const review = getReviewBySlug(slug);
  if (!review) return { title: "見つかりません" };

  const title = review.title;
  const description =
    stripMarkdownForMeta(review.summary) || review.title;
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
      publishedTime: review.publishedAt,
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

  const canonicalUrl = `${siteUrl()}/reviews/${review.slug}/`;
  const best = review.ratingBest ?? 10;

  const isArticle = review.contentKind === "article";
  const nextReview = review.nextSlug
    ? getReviewBySlug(review.nextSlug)
    : undefined;

  const coverEl = (
    <ReviewCover
      coverImage={review.coverImage}
      alt={review.title}
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
  const showAffiliateBesideRating =
    Boolean(finalRatingSplit) && review.affiliateLinks.length > 0;

  return (
    <>
      {!isArticle && (
        <ReviewJsonLd review={review} canonicalUrl={canonicalUrl} />
      )}
      <article className="mx-auto w-full min-w-0 max-w-3xl py-8 sm:py-10 lg:max-w-4xl xl:max-w-5xl xl:py-11">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 transition hover:text-sky-200"
        >
          <span aria-hidden>←</span> {isArticle ? "トップへ" : "レビュー一覧"}
        </Link>

        <AdMaxUnit placement="article-top" className="mt-6 sm:mt-7" />

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
            <div className="border-t border-slate-600/40 bg-slate-900/50 px-5 py-6 sm:px-8 sm:py-8">
              <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-slate-50 sm:text-3xl">
                {review.title}
              </h1>
              <div
                className={`mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 ${!isArticle ? "sm:justify-between" : ""}`}
              >
                {!isArticle && (
                  <StarRating value={review.ratingValue} best={best} size="md" />
                )}
                <p
                  className={`text-sm text-slate-500 ${isArticle ? "sm:ml-auto" : ""}`}
                >
                  <time dateTime={review.publishedAt}>{review.publishedAt}</time>
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
              <div className="mt-5">
                <SummaryMarkdown markdown={review.summary} />
              </div>
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

        <section className="mt-8 min-w-0 rounded-3xl border border-slate-600/45 bg-slate-800/50 px-4 py-7 shadow-md shadow-slate-950/20 backdrop-blur-sm sm:mt-9 sm:px-8 sm:py-9">
          {!review.body ? (
            <p className="text-slate-500">本文がまだありません。</p>
          ) : finalRatingSplit ? (
            <>
              {finalRatingSplit.before.trim() ? (
                <ReviewMarkdown markdown={finalRatingSplit.before} />
              ) : null}
              <div className="mt-10 flex flex-col gap-6 border-t border-slate-700/50 pt-8 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                <div className="min-w-0 flex-1">
                  <h2
                    id="final-rating-heading"
                    className="mb-3 scroll-mt-24 text-xl font-bold tracking-tight text-slate-50"
                  >
                    総合評価
                  </h2>
                  <ReviewMarkdown markdown={finalRatingSplit.after} />
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
            </>
          ) : (
            <ReviewMarkdown markdown={review.body} />
          )}
        </section>

        {nextReview ? <ArticleNextNav next={nextReview} /> : null}

        {review.affiliateLinks.length > 0 && !showAffiliateBesideRating && (
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
