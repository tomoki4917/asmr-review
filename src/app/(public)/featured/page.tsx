import type { Metadata } from "next";
import { DevSiteNextHeader } from "@/components/dev/DevSiteNextHeader";
import { FeaturedPicksHub } from "@/components/FeaturedPicksHub";
import {
  FEATURED_PICKS_HUB_INTRO,
  FEATURED_PICKS_HUB_SLUGS,
} from "@/lib/featured-picks-hub";
import {
  DEV_SITE_NEXT_LIST_BASE,
  FEATURED_PICKS_HUB_PATH,
} from "@/lib/review-list-href";
import { getAllReviews } from "@/lib/reviews";
import { SITE_NAME } from "@/lib/site-brand";

export const metadata: Metadata = {
  title: "厳選・おすすめ",
  description:
    `${SITE_NAME}がデータと聴取で選んだ厳選おすすめ。初心者向け特集記事など、迷ったときのまとめコンテンツを掲載しています。`,
  alternates: { canonical: FEATURED_PICKS_HUB_PATH },
};

export default function FeaturedPicksPage() {
  const reviews = getAllReviews();
  const reviewBySlug = new Map(reviews.map((r) => [r.slug, r]));
  const picks = FEATURED_PICKS_HUB_SLUGS.map((slug) => reviewBySlug.get(slug))
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((review) => ({ review }));
  const useDevChrome = process.env.NODE_ENV === "development";

  return (
    <main className="mx-auto w-full max-w-3xl pb-10">
      {useDevChrome ? (
        <>
          <p className="border-b border-amber-600/30 bg-amber-950/20 px-4 py-2 text-center text-[11px] font-medium tracking-wide text-amber-200/90">
            次サイト草案と共通の厳選・おすすめハブ
          </p>
          <DevSiteNextHeader />
        </>
      ) : null}

      <FeaturedPicksHub
        title="厳選・おすすめ"
        intro={FEATURED_PICKS_HUB_INTRO}
        picks={picks}
        articleBadge="厳選記事"
        headerVariant="category"
        emoji="👑"
        breadcrumb={{
          href: useDevChrome ? DEV_SITE_NEXT_LIST_BASE : "/",
          label: "TOP",
        }}
        showFooterLink={false}
        homeHref={useDevChrome ? DEV_SITE_NEXT_LIST_BASE : "/"}
        homeLabel={
          useDevChrome ? "次サイト草案トップへ戻る" : "トップへ戻る"
        }
      />
    </main>
  );
}
