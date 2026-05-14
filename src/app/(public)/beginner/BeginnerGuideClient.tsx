"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { FileMarkdownArticleCard } from "@/components/FileMarkdownArticleCard";
import type { Review } from "@/lib/types";

type RouteId = 1 | 2;

type Props = {
  /** ルート1・2の「作品おすすめ記事」に共通表示（一覧からは除外された記事） */
  recommendedArticle: Review | null;
};

function BeginnerRecommendedArticleSlot({ article }: { article: Review | null }) {
  if (article) {
    return (
      <div className="mt-2">
        <FileMarkdownArticleCard review={article} />
      </div>
    );
  }
  return (
    <p className="mt-2 rounded-xl border border-dashed border-amber-500/35 bg-slate-950/35 px-4 py-6 text-center text-sm leading-relaxed text-slate-400">
      おすすめ記事を読み込めませんでした。記事ファイルの slug が正しいか確認してください。
    </p>
  );
}

/**
 * ビギナーズガイド：共通導入＋ルート切替（最短で没入 / 仕組みから理解）と各スロット。
 */
export function BeginnerGuideClient({ recommendedArticle }: Props) {
  const [route, setRoute] = useState<RouteId>(1);
  const panelId = useId();

  return (
    <div className="mx-auto w-full max-w-4xl pb-16 pt-8 sm:pt-10">
      <Link
        href="/"
        className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-sky-300 transition hover:text-sky-200"
      >
        <span aria-hidden>←</span>
        トップへ
      </Link>

      <section
        aria-labelledby={`${panelId}-hero`}
        lang="ja"
        className="mt-8 text-center sm:mt-10"
      >
        <span className="sr-only">共通：導入</span>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400/90">
          beginner · hypnosis · guide
        </p>
        <h1
          id={`${panelId}-hero`}
          className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl"
        >
          「ようこそ、最高の没入体験へ」
        </h1>
        <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:gap-4">
          <span
            aria-hidden
            className="h-px w-10 shrink-0 bg-gradient-to-r from-transparent via-sky-300/70 to-transparent sm:w-16"
          />
          <p className="max-w-[min(100%,28rem)] text-pretty text-base font-semibold leading-snug tracking-[0.03em] text-slate-100 sm:text-xl sm:leading-relaxed md:text-2xl">
            <span className="bg-gradient-to-r from-sky-100 via-cyan-200 to-teal-200 bg-clip-text text-transparent [text-shadow:0_0_18px_rgba(56,189,248,0.18)]">
              催眠音声の世界へようこそ。
            </span>
          </p>
          <span
            aria-hidden
            className="h-px w-10 shrink-0 bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent sm:w-16"
          />
        </div>
        <div className="mx-auto mt-5 max-w-2xl break-keep text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
          <p>
            「自分にもかかるかな？」「何を選べばいいの？」
            <wbr />
            と迷っている方も、どうぞ安心してください。
          </p>
          <p className="mt-2">
            催眠音声は魔法ではなく、
            <wbr />
            脳を心地よくリラックスさせるための「コツ」があるだけなんです。
          </p>
          <p className="mt-6">「あなたは直感で楽しみたい派ですか？」</p>
          <p className="mt-1">「それとも、納得してから深まりたい派ですか？」</p>
        </div>
        <p className="mx-auto mt-3 max-w-2xl break-keep text-pretty text-base font-semibold leading-relaxed text-slate-200 sm:text-lg">
          自分に合ったモードを選択して最高の催眠体験へ
        </p>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setRoute(1)}
          aria-pressed={route === 1}
          aria-label="最短で没入する（ルート1）"
          className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full border px-5 py-3 text-center text-sm font-semibold leading-snug transition sm:min-h-[3.75rem] sm:text-base ${
            route === 1
              ? "border-sky-500/50 bg-sky-500/15 text-sky-100"
              : "border-slate-500/50 bg-slate-800/50 text-slate-200 hover:border-slate-400/60 hover:bg-slate-800/70"
          }`}
        >
          <span className="text-lg leading-none sm:text-xl" aria-hidden>
            ⚡
          </span>
          <span>最短で没入する</span>
        </button>
        <button
          type="button"
          onClick={() => setRoute(2)}
          aria-pressed={route === 2}
          aria-label="仕組みから理解する（ルート2）"
          className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full border px-5 py-3 text-center text-sm font-semibold leading-snug transition sm:min-h-[3.75rem] sm:text-base ${
            route === 2
              ? "border-sky-500/50 bg-sky-500/15 text-sky-100"
              : "border-slate-500/50 bg-slate-800/50 text-slate-200 hover:border-slate-400/60 hover:bg-slate-800/70"
          }`}
        >
          <span className="text-lg leading-none sm:text-xl" aria-hidden>
            🧠
          </span>
          <span>仕組みから理解する</span>
        </button>
      </div>

      <div
        className="mt-8 space-y-6"
        role="tabpanel"
        id={`${panelId}-panel`}
        aria-live="polite"
      >
        {route === 1 ? (
          <>
            <section aria-labelledby={`${panelId}-r1-a`}>
              <h3
                id={`${panelId}-r1-a`}
                className="text-sm font-bold text-slate-200 sm:text-base"
              >
                ルート1：視聴環境記事
              </h3>
              <div
                className="mt-2 min-h-[5rem] rounded-xl border border-dashed border-slate-600/55 bg-slate-950/35 sm:min-h-[6rem]"
                aria-hidden
              />
            </section>
            <section aria-labelledby={`${panelId}-r1-b`}>
              <h3
                id={`${panelId}-r1-b`}
                className="text-sm font-bold text-slate-200 sm:text-base"
              >
                ルート1：作品おすすめ記事
              </h3>
              <BeginnerRecommendedArticleSlot article={recommendedArticle} />
            </section>
          </>
        ) : (
          <>
            <section aria-labelledby={`${panelId}-r2-intro`}>
              <h3
                id={`${panelId}-r2-intro`}
                className="text-sm font-bold text-slate-200 sm:text-base"
              >
                ルート2：導入
              </h3>
              <div
                className="mt-2 min-h-[4rem] rounded-xl border border-dashed border-slate-600/55 bg-slate-950/35"
                aria-hidden
              />
            </section>
            <section aria-labelledby={`${panelId}-r2-a`}>
              <h3
                id={`${panelId}-r2-a`}
                className="text-sm font-bold text-slate-200 sm:text-base"
              >
                ルート2：催眠のメカニズム
              </h3>
              <div
                className="mt-2 min-h-[5rem] rounded-xl border border-dashed border-slate-600/55 bg-slate-950/35 sm:min-h-[6rem]"
                aria-hidden
              />
            </section>
            <section aria-labelledby={`${panelId}-r2-b`}>
              <h3
                id={`${panelId}-r2-b`}
                className="text-sm font-bold text-slate-200 sm:text-base"
              >
                ルート2：視聴環境
              </h3>
              <div
                className="mt-2 min-h-[5rem] rounded-xl border border-dashed border-slate-600/55 bg-slate-950/35 sm:min-h-[6rem]"
                aria-hidden
              />
            </section>
            <section aria-labelledby={`${panelId}-r2-c`}>
              <h3
                id={`${panelId}-r2-c`}
                className="text-sm font-bold text-slate-200 sm:text-base"
              >
                ルート2：作品おすすめ記事
              </h3>
              <BeginnerRecommendedArticleSlot article={recommendedArticle} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
