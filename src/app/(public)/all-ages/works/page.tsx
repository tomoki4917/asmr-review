import type { Metadata } from "next";
import { WorksListHub } from "@/components/WorksListHub";
import {
  ALL_AGES_WORKS_INTRO,
  ALL_AGES_WORKS_PATH,
} from "@/lib/all-ages-site-chrome";
import { ALL_AGES_SITE_BASE } from "@/lib/site-rating-switch";
import { getAllAgesReviewsForList } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "作品を探す（全年齢向け）",
  description: ALL_AGES_WORKS_INTRO,
  alternates: { canonical: ALL_AGES_WORKS_PATH },
};

export default function AllAgesWorksPage() {
  const reviews = getAllAgesReviewsForList();

  return (
    <main className="mx-auto w-full max-w-6xl">
      <WorksListHub
        markdownReviews={reviews}
        basePath={ALL_AGES_WORKS_PATH}
        breadcrumbHref={ALL_AGES_SITE_BASE}
        intro={ALL_AGES_WORKS_INTRO}
        title="作品を探す"
        listPreparingMode
        hideGenreFilter
      />
    </main>
  );
}
