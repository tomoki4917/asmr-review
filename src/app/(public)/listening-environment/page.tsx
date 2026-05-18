import type { Metadata } from "next";
import Link from "next/link";
import { FileMarkdownArticleCard } from "@/components/FileMarkdownArticleCard";
import { getListeningEnvironmentHubArticles } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "視聴環境",
  description:
    "部屋のセッティング・イヤホン選びなど、催眠音声を没入しやすくするための記事一覧です。",
};

export default function ListeningEnvironmentHubPage() {
  const articles = getListeningEnvironmentHubArticles();

  return (
    <div className="mx-auto min-h-svh w-full max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <Link
        href="/"
        className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-sky-300 transition hover:text-sky-200"
      >
        <span aria-hidden>←</span>
        トップへ
      </Link>

      <header className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400/90">
          listening environment
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          視聴環境
        </h1>
        <p className="mt-4 text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
          催眠音声は作品の質だけでなく、<strong className="font-medium text-slate-100">どこで・どう聴くか</strong>
          でも体感が変わります。部屋の光や温度、バイノーラル向けのイヤホンなど、没入のための準備をまとめた記事です。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          初めての方は
          <Link href="/beginner/" className="mx-1 font-medium text-sky-300 hover:text-sky-200">
            催眠音声ビギナーズガイド
          </Link>
          の「視聴環境」ステップから順に進めても大丈夫です。
        </p>
      </header>

      <section className="mt-10" aria-labelledby="listening-environment-articles-heading">
        <h2
          id="listening-environment-articles-heading"
          className="text-lg font-bold text-slate-50 sm:text-xl"
        >
          記事一覧
        </h2>
        {articles.length > 0 ? (
          <ul className="mt-6 space-y-6">
            {articles.map((review, index) => (
              <li key={review.slug}>
                <FileMarkdownArticleCard
                  review={review}
                  priorityImage={index === 0}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-slate-600/45 bg-slate-900/35 px-4 py-8 text-center text-sm leading-relaxed text-slate-400">
            視聴環境タグの記事がまだありません。
          </p>
        )}
      </section>

    </div>
  );
}
