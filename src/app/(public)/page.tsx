import Link from "next/link";
import { Suspense } from "react";
import { AdMaxUnit } from "@/components/AdMaxUnit";
import { HomeReviewList } from "@/components/HomeReviewList";
import { PsychologyInsightsSection } from "@/components/PsychologyInsightsSection";
import { ReviewCover } from "@/components/ReviewCover";
import { StarRating } from "@/components/StarRating";
import { getAllReviews } from "@/lib/reviews";
import type { Review } from "@/lib/types";

/** トップで先に見せたいレビュー（該当 slug の Markdown があれば表示） */
const SPOTLIGHT_REVIEW_SLUGS = ["kyoku-mugen-zekkyou-count-chikuni"] as const;

function SpotlightReviews({ reviews }: { reviews: Review[] }) {
  const items = SPOTLIGHT_REVIEW_SLUGS.map((slug) =>
    reviews.find((r) => r.slug === slug)
  ).filter((r): r is Review => r != null);

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
        直近に投稿したレビューから、★9以上と評価した作品をピックアップしています。
      </p>
      <ul className="mt-6 space-y-4">
        {items.map((r) => {
          const best = r.ratingBest ?? 10;
          return (
            <li key={r.slug}>
              <Link
                href={`/reviews/${r.slug}/`}
                className="group block overflow-hidden rounded-2xl border border-slate-600/45 bg-slate-800/50 shadow-md shadow-slate-950/25 ring-1 ring-sky-900/20 transition hover:-translate-y-0.5 hover:border-sky-500/35 hover:shadow-lg hover:shadow-sky-950/15 hover:ring-sky-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/45"
              >
                <ReviewCover
                  coverImage={r.coverImage}
                  alt={r.title}
                  slug={r.slug}
                  priority
                  className="rounded-none"
                />
                <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6 sm:py-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/90">
                      作品レビュー
                    </p>
                    <h3 className="mt-1 text-balance text-lg font-bold leading-snug text-slate-50 group-hover:text-sky-200 sm:text-xl">
                      {r.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">
                      {r.summary}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    <StarRating value={r.ratingValue} best={best} size="md" />
                    <span className="text-sm font-semibold text-sky-300 transition group-hover:text-sky-200">
                      レビューを読む
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

const BEGINNER_GUIDE_SLUGS = [
  "hypnosis-mechanism-01",
  "nou-iki-toha",
  "dry-orgasm-what-is",
] as const;

function pickBeginnerGuides(reviews: Review[]): Review[] {
  return BEGINNER_GUIDE_SLUGS.map((slug) =>
    reviews.find((r) => r.slug === slug)
  ).filter((r): r is Review => r != null);
}

export default function HomePage() {
  const reviews = getAllReviews();
  const beginnerGuides = pickBeginnerGuides(reviews);

  return (
    <main className="mx-auto w-full max-w-6xl py-10 sm:py-14">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400/90">
          hypnosis · ASMR · psychology
        </p>
        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          催眠音声レビュー室
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-slate-400">
          主に同人音声を主観と客観的なデータに基づいてレビューさせていただいております。色んな作品が溢れている昨今、「少しでも読者様の参考になれば」という思いで投稿しています。
        </p>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-base leading-relaxed text-slate-400">
          忖度無しのガチレビューです。
        </p>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-base leading-relaxed text-slate-400">
          質問などあれば
          <Link
            href="/contact/"
            className="font-medium text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
          >
            問い合わせフォーム
          </Link>
          にてお待ちしております。
        </p>
      </header>

      <div className="mx-auto mt-10 flex justify-center overflow-x-hidden">
        <AdMaxUnit placement="home-top" />
      </div>

      <SpotlightReviews reviews={reviews} />

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
