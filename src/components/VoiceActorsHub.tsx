import { Suspense } from "react";
import { CategoryHubHeader } from "@/components/CategoryHubHeader";
import { VoiceActorsHubSearchPanel } from "@/components/VoiceActorsHubSearchPanel";
import { reviewTitleSingleLine } from "@/lib/review-title";
import { VOICE_ACTORS_HUB_INTRO } from "@/lib/voice-actors-hub";
import type { VoiceActorHubEntry } from "@/lib/review-voice-actors";
import type { Review } from "@/lib/types";

type Props = {
  voiceActors: VoiceActorHubEntry[];
  reviewBySlug: Map<string, Review>;
  listBasePath: string;
  breadcrumbHref: string;
};

export function VoiceActorsHub({
  voiceActors,
  reviewBySlug,
  listBasePath,
  breadcrumbHref,
}: Props) {
  const featuredTitleBySlug: Record<string, string> = {};
  for (const entry of voiceActors) {
    for (const slug of entry.featuredSlugs) {
      const review = reviewBySlug.get(slug);
      if (review) featuredTitleBySlug[slug] = reviewTitleSingleLine(review.title);
    }
  }

  return (
    <div className="px-4 pb-10 pt-8 sm:px-6 sm:pt-10">
      <CategoryHubHeader
        title="声優別おすすめ作品"
        intro={VOICE_ACTORS_HUB_INTRO}
        emoji="🎤"
        breadcrumb={{ href: breadcrumbHref, label: "TOP" }}
      />

      <Suspense
        fallback={
          <p className="mt-10 text-center text-sm text-slate-500">
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
    </div>
  );
}
