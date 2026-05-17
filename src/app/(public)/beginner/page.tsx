import type { Metadata } from "next";
import {
  BEGINNER_GUIDE_DRY_ORGASM_ARTICLE_SLUG,
  BEGINNER_GUIDE_LISTENING_ENVIRONMENT_ARTICLE_SLUG,
  BEGINNER_GUIDE_MECHANISM_ARTICLE_SLUG,
  BEGINNER_GUIDE_NOU_IKI_ARTICLE_SLUG,
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
  const listeningEnvironmentArticle =
    getReviewBySlug(BEGINNER_GUIDE_LISTENING_ENVIRONMENT_ARTICLE_SLUG) ?? null;
  const mechanismArticle =
    getReviewBySlug(BEGINNER_GUIDE_MECHANISM_ARTICLE_SLUG) ?? null;
  const nouIkiArticle =
    getReviewBySlug(BEGINNER_GUIDE_NOU_IKI_ARTICLE_SLUG) ?? null;
  const dryOrgasmArticle =
    getReviewBySlug(BEGINNER_GUIDE_DRY_ORGASM_ARTICLE_SLUG) ?? null;

  return (
    <div className="mx-auto min-h-svh w-full max-w-5xl px-4 sm:px-6">
      <BeginnerGuideClient
        recommendedArticle={recommendedArticle}
        listeningEnvironmentArticle={listeningEnvironmentArticle}
        mechanismArticle={mechanismArticle}
        nouIkiArticle={nouIkiArticle}
        dryOrgasmArticle={dryOrgasmArticle}
      />
    </div>
  );
}
