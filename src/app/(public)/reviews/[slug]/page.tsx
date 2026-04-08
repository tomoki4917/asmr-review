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
import { stripMarkdownForMeta } from "@/lib/strip-markdown-lite";

type Props = { params: Promise<{ slug: string }> };

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

  return (
    <>
      {!isArticle && (
        <ReviewJsonLd review={review} canonicalUrl={canonicalUrl} />
      )}
      <article className="mx-auto w-full max-w-3xl py-8 sm:py-12">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 transition hover:text-sky-200"
        >
          <span aria-hidden>←</span> {isArticle ? "トップへ" : "レビュー一覧"}
        </Link>

        <AdMaxUnit placement="article-top" className="mt-8" />

        <header className="mt-6">
          <div className="overflow-hidden rounded-3xl border border-slate-600/45 bg-slate-800/50 shadow-lg shadow-slate-950/25 backdrop-blur-sm">
            <ReviewCover
              coverImage={review.coverImage}
              alt={review.title}
              slug={review.slug}
              priority
              variant="hero"
              className="rounded-none"
            />
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
            </div>
          </div>
        </header>

        <section className="mt-10 rounded-3xl border border-slate-600/45 bg-slate-800/50 px-5 py-8 shadow-md shadow-slate-950/20 backdrop-blur-sm sm:px-8 sm:py-10">
          {review.body ? (
            <ReviewMarkdown markdown={review.body} />
          ) : (
            <p className="text-slate-500">本文がまだありません。</p>
          )}
        </section>

        {nextReview ? <ArticleNextNav next={nextReview} /> : null}

        {review.affiliateLinks.length > 0 && (
          <section className="mt-10 rounded-3xl border border-slate-600/40 bg-slate-800/40 px-5 py-8 sm:px-8">
            <h2 className="text-lg font-bold text-slate-50">
              購入・視聴
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              以下はアフィリエイトリンクを含む場合があります。
            </p>
            <AffiliateButtonGroup links={review.affiliateLinks} className="mt-5" />
          </section>
        )}
      </article>
    </>
  );
}
