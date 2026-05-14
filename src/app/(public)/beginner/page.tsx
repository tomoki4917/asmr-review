import type { Metadata } from "next";
import {
  BEGINNER_GUIDE_RECOMMENDED_WORKS_ARTICLE_SLUG,
  getReviewBySlug,
} from "@/lib/reviews";
import { BeginnerGuideClient } from "./BeginnerGuideClient";

export const metadata: Metadata = {
  title: "ビギナーズガイド",
};

export default function BeginnerPage() {
  const recommendedArticle =
    getReviewBySlug(BEGINNER_GUIDE_RECOMMENDED_WORKS_ARTICLE_SLUG) ?? null;

  return (
    <div className="mx-auto min-h-svh w-full max-w-5xl px-4 sm:px-6">
      <BeginnerGuideClient recommendedArticle={recommendedArticle} />
    </div>
  );
}
