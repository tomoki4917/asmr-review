import { SocialLandingArticleList } from "@/components/SocialLandingArticleList";
import { YouTubeWelcomeHero } from "@/components/social-landing/YouTubeWelcomeHero";
import type { Review } from "@/lib/types";

type Props = {
  reviews: Review[];
};

/** `/welcome/youtube/` — 全年齢固定・バナー＋CTA＋一般向け記事 */
export function WelcomeFromYouTubePage({ reviews }: Props) {
  return (
    <main className="mx-auto max-w-5xl pb-16 pt-8 sm:pb-20 sm:pt-10">
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-sky-400/90">
        YouTube からのご案内
      </p>

      <div className="mt-6 sm:mt-8">
        <YouTubeWelcomeHero />
      </div>

      {reviews.length === 0 ? (
        <p className="mt-12 text-center text-sm text-slate-500">
          現在、こちらに掲載する記事の準備中です。
        </p>
      ) : (
        <>
          <h2 className="mt-12 text-center text-lg font-bold tracking-tight text-slate-50 sm:text-xl">
            一般向けの記事
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-slate-400">
            動画の説明欄などからお越しいただいた方向けです。気になるタイトルから読み始めてください。
          </p>
          <SocialLandingArticleList reviews={reviews} />
        </>
      )}
    </main>
  );
}
