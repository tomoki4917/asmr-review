import { AllAgesSpotlightReview } from "@/components/all-ages/AllAgesSpotlightReview";
import { YouTubeWelcomeHero } from "@/components/social-landing/YouTubeWelcomeHero";
import { getAllAgesReviewsForList } from "@/lib/reviews";

/** `/welcome/youtube/` — ヒーロー＋全年齢ピックアップのみ */
export function WelcomeFromYouTubePage() {
  const reviews = getAllAgesReviewsForList();

  return (
    <main className="mx-auto w-full max-w-7xl py-10 sm:py-14">
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-sky-400/90">
        YouTube からのご案内
      </p>

      <div className="mt-6 sm:mt-8">
        <YouTubeWelcomeHero />
      </div>

      <div className="mx-auto mt-12 max-w-3xl px-4 sm:mt-14 sm:px-0">
        <AllAgesSpotlightReview
          reviews={reviews}
          headingId="youtube-pickup-review-heading"
        />
      </div>
    </main>
  );
}
