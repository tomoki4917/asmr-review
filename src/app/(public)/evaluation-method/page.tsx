import type { Metadata } from "next";
import Link from "next/link";
import { FileMarkdownArticleCard } from "@/components/FileMarkdownArticleCard";
import { getEvaluationMethodHubArticle } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "評価メソッド",
  description:
    "当サイトの催眠音声レビューで使う解析手順・採点の根拠をまとめた記事です。",
};

export default function EvaluationMethodHubPage() {
  const article = getEvaluationMethodHubArticle();

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
          evaluation method
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          評価メソッド
        </h1>
        <p className="mt-4 text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
          WhisperX・音響解析・心拍ログ・聴取体感を組み合わせ、作品をどのような手順と根拠で見ているかを開示します。数値は作品を読み解く材料であり、医学的効果の保証ではありません。
        </p>
      </header>

      <section className="mt-10" aria-labelledby="evaluation-method-articles-heading">
        <h2
          id="evaluation-method-articles-heading"
          className="text-lg font-bold text-slate-50 sm:text-xl"
        >
          記事一覧
        </h2>
        {article ? (
          <ul className="mt-6 space-y-6">
            <li>
              <FileMarkdownArticleCard review={article} priorityImage />
            </li>
          </ul>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-slate-600/45 bg-slate-900/35 px-4 py-8 text-center text-sm leading-relaxed text-slate-400">
            評価メソッドの記事を読み込めませんでした。
          </p>
        )}
      </section>
    </div>
  );
}
