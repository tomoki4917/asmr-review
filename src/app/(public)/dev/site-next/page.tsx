import type { Metadata } from "next";
import Link from "next/link";
import { DevSiteNextMyBestStyleSection } from "@/components/dev/DevSiteNextMyBestStyleSection";
import { HomeHeroIntro } from "@/components/home/HomeHeroIntro";
import { getReviewBySlug } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "次サイト（草案・開発のみ）",
  description:
    "サイト再構築用の下書きエリア。開発サーバーで表示し、本番ビルドでは案内のみになります。",
};

export default function DevSiteNextPage() {
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center text-slate-400">
        <p className="text-sm leading-relaxed">
          このページは開発サーバー（<code className="text-slate-300">npm run dev</code>
          ）でのみ利用できます。本番の静的出力ではプレースホルダのみです。
        </p>
        <p className="mt-6">
          <Link
            href="/"
            className="text-sm font-medium text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
          >
            トップへ戻る
          </Link>
        </p>
      </main>
    );
  }

  const unknownHypno = getReviewBySlug("unknown-hypno-daijobu-koe-ni-yudanete");

  return (
    <main className="mx-auto w-full max-w-7xl py-10 sm:py-14">
      <div className="mx-auto max-w-4xl rounded-2xl border border-sky-500/25 bg-slate-900/35 px-5 py-8 shadow-inner ring-1 ring-white/5 sm:px-10 sm:py-10">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-amber-200/90">
          dev / 次サイトの芽
        </p>
        <header className="mx-auto mt-4 max-w-3xl text-center">
          <HomeHeroIntro />
        </header>
      </div>

      <DevSiteNextMyBestStyleSection unknownHypno={unknownHypno} />

      <section className="mx-auto mt-12 max-w-3xl border-t border-slate-600/50 pt-8 text-center text-sm text-slate-500">
        <p className="text-pretty">
          上記は現行トップと同じ「冒頭」ブロックです。この下にセクションを足して、新しいトップや別ランディングへ育てていけます。
        </p>
        <Link
          href="/"
          className="mt-6 inline-block font-medium text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
        >
          現行トップへ戻る
        </Link>
      </section>
    </main>
  );
}
