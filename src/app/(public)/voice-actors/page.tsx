import type { Metadata } from "next";
import { DevSiteNextHeader } from "@/components/dev/DevSiteNextHeader";
import { VoiceActorsHub } from "@/components/VoiceActorsHub";
import { collectVoiceActorHubEntries } from "@/lib/review-voice-actors";
import {
  DEV_SITE_NEXT_LIST_BASE,
  VOICE_ACTORS_HUB_PATH,
} from "@/lib/review-list-href";
import { getAllReviews } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "声優別おすすめ作品",
  description:
    "声優名・系統（甘々・ドS・ドM）から、催眠音声解析室のおすすめレビューを探す一覧です。",
  alternates: { canonical: VOICE_ACTORS_HUB_PATH },
};

export default function VoiceActorsPage() {
  const reviews = getAllReviews();
  const reviewBySlug = new Map(reviews.map((r) => [r.slug, r]));
  const voiceActors = collectVoiceActorHubEntries(reviews);
  const useDevChrome = process.env.NODE_ENV === "development";

  return (
    <main className="mx-auto w-full max-w-2xl pb-10">
      {useDevChrome ? (
        <>
          <p className="border-b border-amber-600/30 bg-amber-950/20 px-4 py-2 text-center text-[11px] font-medium tracking-wide text-amber-200/90">
            次サイト草案と共通の声優別ハブ
          </p>
          <DevSiteNextHeader />
        </>
      ) : null}

      <VoiceActorsHub
        voiceActors={voiceActors}
        reviewBySlug={reviewBySlug}
        listBasePath={useDevChrome ? DEV_SITE_NEXT_LIST_BASE : "/"}
        homeHref={useDevChrome ? "/dev/site-next/" : "/"}
        homeLabel={
          useDevChrome ? "次サイト草案トップへ戻る" : "トップへ戻る"
        }
      />
    </main>
  );
}
