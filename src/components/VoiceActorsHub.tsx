import Link from "next/link";
import { Suspense } from "react";
import { ReviewCover } from "@/components/ReviewCover";
import { StarRating } from "@/components/StarRating";
import { VoiceActorsHubSearchPanel } from "@/components/VoiceActorsHubSearchPanel";
import { reviewTitleSingleLine } from "@/lib/review-title";
import type { VoiceActorHubEntry } from "@/lib/review-voice-actors";
import { VOICE_ACTOR_HUB_SPOTLIGHT_SLUGS } from "@/lib/voice-actor-hub-picks";
import type { Review } from "@/lib/types";

const INTRO = `「どの声優の作品を聴けばいい？」を解決するおすすめ人気コンテンツ一覧です。
耳元での囁きの技術や声質の相性、演技の傾向まで幅広く解析。作品選びで絶対にハズしたくない人のために、声のスペックや実際の体感データから多角的に比較・検証して最適な作品を紹介します。`;

type Props = {
  voiceActors: VoiceActorHubEntry[];
  reviewBySlug: Map<string, Review>;
  listBasePath: string;
  homeHref: string;
  homeLabel: string;
};

export function VoiceActorsHub({
  voiceActors,
  reviewBySlug,
  listBasePath,
  homeHref,
  homeLabel,
}: Props) {
  const spotlightReviews = VOICE_ACTOR_HUB_SPOTLIGHT_SLUGS.map((slug) =>
    reviewBySlug.get(slug)
  ).filter((r): r is Review => r != null);

  const featuredTitleBySlug = Object.fromEntries(
    spotlightReviews.map((r) => [r.slug, reviewTitleSingleLine(r.title)])
  );

  return (
    <div className="px-4 pt-6 sm:px-5">
      <h1 className="text-center text-lg font-bold tracking-tight text-slate-50 sm:text-xl">
        声優別おすすめ作品
      </h1>
      <p className="mt-4 whitespace-pre-line text-left text-xs leading-relaxed text-slate-400 sm:text-[13px]">
        {INTRO}
      </p>

      {spotlightReviews.length > 0 ? (
        <section className="mt-8" aria-labelledby="voice-actor-spotlight">
          <h2
            id="voice-actor-spotlight"
            className="text-sm font-bold text-slate-200"
          >
            おすすめピックアップ
          </h2>
          <ul className="mt-3 space-y-4">
            {spotlightReviews.map((review) => (
              <li key={review.slug}>
                <Link
                  href={`/reviews/${review.slug}/`}
                  className="group flex gap-3 rounded-xl border border-slate-600/45 bg-slate-800/35 p-3 transition hover:border-sky-500/35"
                >
                  <div className="w-[4.5rem] shrink-0">
                    <ReviewCover
                      coverImage={review.coverImage}
                      alt={reviewTitleSingleLine(review.title)}
                      slug={review.slug}
                      className="rounded-md"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-pretty text-sm font-semibold leading-snug text-slate-100 group-hover:text-sky-200">
                      {reviewTitleSingleLine(review.title)}
                    </p>
                    <div className="mt-2">
                      <StarRating
                        value={review.ratingValue}
                        best={review.ratingBest ?? 10}
                        size="sm"
                      />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Suspense
        fallback={
          <p className="mt-8 text-center text-sm text-slate-500">
            フィルタを読み込んでいます…
          </p>
        }
      >
        <VoiceActorsHubSearchPanel
          voiceActors={voiceActors}
          featuredTitleBySlug={featuredTitleBySlug}
          listBasePath={listBasePath}
        />
      </Suspense>

      <p className="mt-8 text-center">
        <Link
          href={homeHref}
          className="text-xs font-medium text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
        >
          {homeLabel}
        </Link>
      </p>
    </div>
  );
}
