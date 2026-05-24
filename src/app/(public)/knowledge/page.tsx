import type { Metadata } from "next";
import { DevSiteNextHeader } from "@/components/dev/DevSiteNextHeader";
import { FeaturedPicksHub } from "@/components/FeaturedPicksHub";
import {
  KNOWLEDGE_COLUMNS_HUB_ENTRIES,
  KNOWLEDGE_COLUMNS_HUB_INTRO,
} from "@/lib/knowledge-columns-hub";
import {
  DEV_SITE_NEXT_LIST_BASE,
  KNOWLEDGE_COLUMNS_HUB_PATH,
} from "@/lib/review-list-href";
import { getAllReviews } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "知識・コラム",
  description:
    "催眠音声のメカニズム、脳イキ、ドライオーガズムまで。作品を深く楽しむための解説コラムを順に読めます。",
  alternates: { canonical: KNOWLEDGE_COLUMNS_HUB_PATH },
};

export default function KnowledgeColumnsPage() {
  const reviews = getAllReviews();
  const reviewBySlug = new Map(reviews.map((r) => [r.slug, r]));
  const picks = KNOWLEDGE_COLUMNS_HUB_ENTRIES.map(({ slug, cardTitle }) => {
    const review = reviewBySlug.get(slug);
    return review ? { review, cardTitle } : null;
  }).filter((p): p is NonNullable<typeof p> => p != null);
  const useDevChrome = process.env.NODE_ENV === "development";

  return (
    <main className="mx-auto w-full max-w-3xl pb-10">
      {useDevChrome ? (
        <>
          <p className="border-b border-amber-600/30 bg-amber-950/20 px-4 py-2 text-center text-[11px] font-medium tracking-wide text-amber-200/90">
            次サイト草案と共通の知識・コラムハブ
          </p>
          <DevSiteNextHeader />
        </>
      ) : null}

      <FeaturedPicksHub
        title="知識・コラム"
        intro={KNOWLEDGE_COLUMNS_HUB_INTRO}
        picks={picks}
        articleBadge="解説記事"
        headerVariant="category"
        emoji="📚"
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
