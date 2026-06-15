import Image from "next/image";
import Link from "next/link";
import { getAllAgesSiteUrl } from "@/lib/site-rating-switch";

const YOUTUBE_WELCOME_HERO_SRC = "/images/welcome/youtube-hero-banner.png";

/** YouTube 流入ページ：サイトバナー＋全年齢トップへの CTA */
export function YouTubeWelcomeHero() {
  return (
    <section
      aria-labelledby="youtube-welcome-hero-heading"
      className="mx-auto max-w-3xl"
    >
      <h1 id="youtube-welcome-hero-heading" className="sr-only">
        ムキネコ解析室 — YouTube からのご案内
      </h1>
      <div className="overflow-hidden rounded-2xl border border-amber-500/35 shadow-lg shadow-slate-950/40 ring-1 ring-amber-400/15">
        <Image
          src={YOUTUBE_WELCOME_HERO_SRC}
          alt="ムキネコ解析室 — あなたに、最高の没入と、心穏やかな時間を。"
          width={1200}
          height={630}
          priority
          className="h-auto w-full"
          sizes="(max-width: 768px) 100vw, 768px"
        />
      </div>
      <div className="mt-6 flex justify-center sm:mt-8">
        <Link
          href={getAllAgesSiteUrl()}
          className="inline-flex min-h-12 w-full max-w-md items-center justify-center rounded-xl bg-sky-500 px-8 py-3.5 text-base font-semibold text-white shadow-md shadow-sky-950/30 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/50 sm:text-lg"
        >
          全年齢レビューページへ
        </Link>
      </div>
    </section>
  );
}
