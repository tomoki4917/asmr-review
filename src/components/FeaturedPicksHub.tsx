import Link from "next/link";
import { CategoryHubHeader } from "@/components/CategoryHubHeader";
import { ReviewCover } from "@/components/ReviewCover";
import { StarRating } from "@/components/StarRating";
import { SummaryMarkdown } from "@/components/SummaryMarkdown";
import { ReviewDlsiteListPrice } from "@/components/ReviewDlsiteListPrice";
import { reviewTitleSingleLine } from "@/lib/review-title";
import type { Review } from "@/lib/types";

export type CuratedHubPick = {
  review: Review;
  /** カード見出し（省略時は記事 title を1行化） */
  cardTitle?: string;
};

type Props = {
  title: string;
  intro: string;
  picks: CuratedHubPick[];
  homeHref: string;
  homeLabel: string;
  articleBadge?: string;
  /** カテゴリ型ヘッダー（パンくず・アイコン・左寄せ） */
  headerVariant?: "centered" | "category";
  emoji?: string;
  breadcrumb?: { href: string; label: string };
  showFooterLink?: boolean;
};

function FeaturedPickCard({
  review,
  cardTitle,
  priority,
  articleBadge,
}: {
  review: Review;
  cardTitle?: string;
  priority?: boolean;
  articleBadge: string;
}) {
  const titleOne = cardTitle ?? reviewTitleSingleLine(review.title);
  const isArticle = review.contentKind === "article";

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-600/45 bg-slate-800/35 shadow-md shadow-slate-950/20 ring-1 ring-white/[0.04]">
      <Link
        href={`/reviews/${review.slug}/`}
        className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/45"
      >
        <div className="relative overflow-hidden bg-slate-900">
          <ReviewCover
            coverImage={review.coverImage}
            alt={titleOne}
            slug={review.slug}
            priority={priority}
            variant="hero"
            className="rounded-none"
          />
        </div>
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/90">
            {isArticle ? articleBadge : "厳選レビュー"}
          </p>
          <h2 className="mt-2 text-pretty font-serif text-xl font-bold leading-snug tracking-tight text-slate-50 group-hover:text-sky-200 sm:text-2xl">
            {titleOne}
          </h2>
          <div className="mt-3 line-clamp-4 min-h-0 leading-relaxed text-slate-400">
            <SummaryMarkdown markdown={review.summary} className="text-sm sm:text-[0.9375rem]" />
          </div>
          {!isArticle ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <StarRating
                value={review.ratingValue}
                best={review.ratingBest ?? 10}
                size="md"
              />
              <ReviewDlsiteListPrice review={review} />
            </div>
          ) : null}
          <p className="mt-5 text-sm font-semibold text-sky-300 transition group-hover:text-sky-200">
            {isArticle ? "記事を読む" : "レビューを読む"}
            <span
              aria-hidden
              className="ml-1 inline-block transition group-hover:translate-x-0.5"
            >
              →
            </span>
          </p>
        </div>
      </Link>
    </article>
  );
}

export function FeaturedPicksHub({
  title,
  intro,
  picks,
  homeHref,
  homeLabel,
  articleBadge = "厳選記事",
  headerVariant = "centered",
  emoji,
  breadcrumb,
  showFooterLink = true,
}: Props) {
  const isCategoryHeader = headerVariant === "category";

  return (
    <div className={isCategoryHeader ? "px-4 pt-8 sm:px-6 sm:pt-10" : "px-4 pt-6 sm:px-5"}>
      {isCategoryHeader ? (
        <CategoryHubHeader
          title={title}
          intro={intro}
          emoji={emoji}
          breadcrumb={breadcrumb}
        />
      ) : (
        <>
          <h1 className="text-center text-lg font-bold tracking-tight text-slate-50 sm:text-xl">
            {title}
          </h1>
          <p className="mt-4 whitespace-pre-line text-left text-xs leading-relaxed text-slate-400 sm:text-[13px]">
            {intro}
          </p>
        </>
      )}

      {picks.length > 0 ? (
        <section
          className={isCategoryHeader ? "mt-10 space-y-6" : "mt-8 space-y-6"}
          aria-label="キュレーション一覧"
        >
          {picks.map(({ review, cardTitle }, index) => (
            <FeaturedPickCard
              key={review.slug}
              review={review}
              cardTitle={cardTitle}
              priority={index === 0}
              articleBadge={articleBadge}
            />
          ))}
        </section>
      ) : (
        <p className="mt-10 text-center text-sm text-slate-500">
          現在表示できる厳選コンテンツがありません。
        </p>
      )}

      {showFooterLink ? (
        <p className="mt-10 text-center">
          <Link
            href={homeHref}
            className="text-sm font-medium text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
          >
            {homeLabel}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
