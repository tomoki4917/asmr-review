import Link from "next/link";
import { HomeHeroIntro } from "@/components/home/HomeHeroIntro";
import { SITE_NAME_ALL_AGES } from "@/lib/site-brand";
import { getAllAgesSiteUrl } from "@/lib/site-rating-switch";

/** YouTube 流入ページ：トップと同型のテキストヒーロー＋全年齢 CTA */
export function YouTubeWelcomeHero() {
  return (
    <section className="mx-auto max-w-4xl">
      <header className="mx-auto max-w-3xl text-center">
        <HomeHeroIntro siteName={SITE_NAME_ALL_AGES} />
      </header>
      <div className="mt-8 flex justify-center sm:mt-10">
        <Link
          href={getAllAgesSiteUrl()}
          className="inline-flex min-h-12 w-full max-w-md items-center justify-center rounded-xl bg-sky-500 px-8 py-3.5 text-base font-semibold text-white shadow-md shadow-sky-950/30 transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/50 sm:text-lg"
        >
          全年齢レビューページ一覧へ
        </Link>
      </div>
    </section>
  );
}
