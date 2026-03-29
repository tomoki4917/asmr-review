import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AffiliateButtonGroup } from "@/components/AffiliateButton";
import { ReviewCoverPlaceholder } from "@/components/ReviewCover";
import { ReviewJsonLd } from "@/components/ReviewJsonLd";
import { ReviewMarkdown } from "@/components/ReviewMarkdown";
import { StarRating } from "@/components/StarRating";
import { getAllSlugs, getReviewBySlug } from "@/lib/reviews";

type Props = { params: Promise<{ slug: string }> };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function ogImageUrl(review: NonNullable<ReturnType<typeof getReviewBySlug>>) {
  if (!review.coverImage) return undefined;
  if (review.coverImage.startsWith("/")) {
    return new URL(review.coverImage, siteUrl()).toString();
  }
  return review.coverImage;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const review = getReviewBySlug(slug);
  if (!review) return { title: "見つかりません" };

  const title = review.title;
  const description = review.summary;
  const url = `${siteUrl()}/reviews/${slug}`;
  const og = ogImageUrl(review);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: review.publishedAt,
      ...(og ? { images: [{ url: og, alt: review.title }] } : {}),
    },
    twitter: {
      card: og ? "summary_large_image" : "summary",
      title,
      description,
      ...(og ? { images: [og] } : {}),
    },
    alternates: { canonical: url },
  };
}

export default async function ReviewPage({ params }: Props) {
  const { slug } = await params;
  const review = getReviewBySlug(slug);
  if (!review) notFound();

  const canonicalUrl = `${siteUrl()}/reviews/${review.slug}`;
  const best = review.ratingBest ?? 5;
  const cover = review.coverImage;
  const isLocal = cover?.startsWith("/");
  const isRemote =
    cover?.startsWith("http://") || cover?.startsWith("https://");

  return (
    <>
      <ReviewJsonLd review={review} canonicalUrl={canonicalUrl} />
      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-indigo-700 transition hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-200"
        >
          <span aria-hidden>←</span> レビュー一覧
        </Link>

        <header className="mt-6">
          <div className="overflow-hidden rounded-3xl border border-stone-200/90 bg-stone-100 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <div className="relative aspect-[16/9] w-full sm:aspect-[2/1]">
              {cover && isLocal && (
                <Image
                  src={cover}
                  alt={review.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 48rem"
                  priority
                />
              )}
              {cover && isRemote && (
                <Image
                  src={cover}
                  alt={review.title}
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 48rem"
                  priority
                />
              )}
              {!cover && <ReviewCoverPlaceholder slug={review.slug} />}
            </div>
            <div className="border-t border-stone-200/80 bg-white px-5 py-6 dark:border-stone-800 dark:bg-stone-950 sm:px-8 sm:py-8">
              <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-stone-900 dark:text-stone-50 sm:text-3xl">
                {review.title}
              </h1>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <StarRating value={review.ratingValue} best={best} size="md" />
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  <time dateTime={review.publishedAt}>{review.publishedAt}</time>
                  <span className="mx-2 text-stone-300 dark:text-stone-600">·</span>
                  <span>{review.authorName}</span>
                </p>
              </div>
              <ul className="mt-5 flex flex-wrap gap-2">
                {review.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-pretty text-base leading-relaxed text-stone-600 dark:text-stone-400">
                {review.summary}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-10 rounded-3xl border border-stone-200/90 bg-white px-5 py-8 shadow-sm dark:border-stone-800 dark:bg-stone-900/40 sm:px-8 sm:py-10">
          {review.body ? (
            <ReviewMarkdown markdown={review.body} />
          ) : (
            <p className="text-stone-500 dark:text-stone-400">本文がまだありません。</p>
          )}
        </section>

        <section className="mt-10 rounded-3xl border border-stone-200/90 bg-stone-50/80 px-5 py-8 dark:border-stone-800 dark:bg-stone-900/50 sm:px-8">
          <h2 className="text-lg font-bold text-stone-900 dark:text-stone-50">
            購入・視聴
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            以下はアフィリエイトリンクを含む場合があります。
          </p>
          <AffiliateButtonGroup links={review.affiliateLinks} className="mt-5" />
        </section>
      </article>
    </>
  );
}
