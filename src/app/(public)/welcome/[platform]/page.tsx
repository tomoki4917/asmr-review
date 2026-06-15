import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SocialLandingArticleList } from "@/components/SocialLandingArticleList";
import { SocialLandingHypnosisIntroSection } from "@/components/SocialLandingHypnosisIntroSection";
import { SocialLandingTopLink } from "@/components/SocialLandingTopLink";
import { WelcomeFromYouTubePage } from "@/components/social-landing/WelcomeFromYouTubePage";
import { getBeginnerGuides, getReviewsForExternalLanding } from "@/lib/reviews";

const PLATFORMS = ["tiktok", "youtube"] as const;
type Platform = (typeof PLATFORMS)[number];

function isPlatform(s: string): s is Platform {
  return (PLATFORMS as readonly string[]).includes(s);
}

const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
};

export function generateStaticParams(): { platform: string }[] {
  return PLATFORMS.map((platform) => ({ platform }));
}

type Props = { params: Promise<{ platform: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { platform } = await params;
  if (!isPlatform(platform)) {
    return { title: "ご案内" };
  }
  const label = PLATFORM_LABEL[platform];
  return {
    title: `${label} からのご案内`,
    description:
      platform === "youtube"
        ? "YouTube の説明欄などからアクセスされた方向け。全年齢向けレビューページへの案内です。"
        : `${label} の説明欄などからアクセスされた方向け。一般向けの解説記事への案内です。`,
  };
}

export default async function WelcomeFromSnsPage({ params }: Props) {
  const { platform } = await params;
  if (!isPlatform(platform)) notFound();

  const label = PLATFORM_LABEL[platform];
  const reviews = getReviewsForExternalLanding();

  if (platform === "youtube") {
    return <WelcomeFromYouTubePage reviews={reviews} />;
  }

  const beginnerGuides = getBeginnerGuides();

  return (
    <main className="mx-auto max-w-5xl pb-16 pt-8 sm:pb-20 sm:pt-10">
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-sky-400/90">
        {label} からのご案内
      </p>
      <h1 className="mt-2 text-center text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
        一般向けの記事
      </h1>
      <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-slate-400 sm:text-base">
        動画の説明欄などからお越しいただいた方向けのページです。
      </p>

      <SocialLandingHypnosisIntroSection beginnerGuides={beginnerGuides} />

      {reviews.length === 0 ? (
        <p className="mt-12 text-center text-sm text-slate-500">
          現在、こちらに掲載する記事の準備中です。
        </p>
      ) : (
        <SocialLandingArticleList reviews={reviews} />
      )}

      <p className="mt-12 text-center text-xs text-slate-500">
        <SocialLandingTopLink />
      </p>
    </main>
  );
}
