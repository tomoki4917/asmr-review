import type { Metadata } from "next";
import Link from "next/link";
import { DevSiteNextHeader } from "@/components/dev/DevSiteNextHeader";
import { DevSiteNextMyBestStyleSection } from "@/components/dev/DevSiteNextMyBestStyleSection";
import { HomeHeroIntro } from "@/components/home/HomeHeroIntro";
import { getAllReviews } from "@/lib/reviews";

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

  const reviews = getAllReviews();

  return (
    <main className="mx-auto w-full max-w-xl pb-8">
      <p className="border-b border-amber-600/30 bg-amber-950/20 px-4 py-2 text-center text-[11px] font-medium tracking-wide text-amber-200/90">
        dev / 次サイトの芽（ワイヤーフォーム準拠）
      </p>

      <DevSiteNextHeader />

      <section
        className="border-b border-slate-600/35 px-4 py-7 text-center sm:py-8"
        aria-label="サイト紹介"
      >
        <HomeHeroIntro />
      </section>

      <DevSiteNextMyBestStyleSection reviews={reviews} />

      <footer className="mx-auto max-w-lg px-4 pt-4 text-center text-xs text-slate-500">
        <p>
          サークル紹介・声優別など未実装のリンクは一覧へ仮接続しています。
        </p>
        <Link
          href="/"
          className="mt-4 inline-block font-medium text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
        >
          現行トップへ戻る
        </Link>
      </footer>
    </main>
  );
}
