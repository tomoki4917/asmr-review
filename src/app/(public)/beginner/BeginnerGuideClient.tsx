"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { FileMarkdownArticleCard } from "@/components/FileMarkdownArticleCard";
import type { Review } from "@/lib/types";

type RouteId = 1 | 2;

type Props = {
  recommendedArticle: Review | null;
  listeningEnvironmentArticle: Review | null;
  mechanismArticle: Review | null;
  nouIkiArticle: Review | null;
  dryOrgasmArticle: Review | null;
};

type StepItem = {
  title: string;
  hint: string;
  article: Review | null;
  /** ステップ見出し上に出すカテゴリ（例: 視聴環境） */
  categoryEmoji?: string;
  categoryLabel?: string;
};

function BeginnerCategoryMark({
  emoji,
  label,
}: {
  emoji: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
      <span
        className="flex h-16 w-16 select-none items-center justify-center rounded-2xl border border-slate-600/40 bg-slate-900/45 text-[1.95rem] leading-none shadow-md shadow-slate-950/35"
        aria-hidden
      >
        {emoji}
      </span>
      <span className="text-base font-bold text-slate-100 sm:text-lg">{label}</span>
    </div>
  );
}

function BeginnerArticleSlot({ article }: { article: Review | null }) {
  if (article) {
    return (
      <div className="mt-4">
        <FileMarkdownArticleCard review={article} />
      </div>
    );
  }
  return (
    <p className="mt-4 rounded-xl border border-dashed border-amber-500/35 bg-slate-950/35 px-4 py-5 text-center text-sm leading-relaxed text-slate-400">
      記事を読み込めませんでした。記事ファイルの slug が正しいか確認してください。
    </p>
  );
}

function BeginnerStepList({ steps }: { steps: StepItem[] }) {
  return (
    <ol className="mt-6 space-y-8">
      {steps.map((step, index) => (
        <li key={step.categoryLabel ?? step.title} className="relative">
          {index < steps.length - 1 ? (
            <span
              aria-hidden
              className="absolute left-4 top-10 bottom-0 w-px -translate-x-1/2 bg-gradient-to-b from-sky-500/40 to-transparent"
            />
          ) : null}
          <div className="flex gap-3 sm:gap-4">
            <span
              aria-hidden
              className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-sky-400/45 bg-sky-500/15 text-sm font-bold text-sky-100"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              {step.categoryLabel ? (
                <>
                  <span className="sr-only">{step.title}</span>
                  <BeginnerCategoryMark
                    emoji={step.categoryEmoji ?? "🎧"}
                    label={step.categoryLabel}
                  />
                </>
              ) : (
                <h3 className="text-base font-bold text-slate-100 sm:text-lg">
                  {step.title}
                </h3>
              )}
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {step.hint}
              </p>
              <BeginnerArticleSlot article={step.article} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const ROUTE_PANEL: Record<
  RouteId,
  { emoji: string; heading: string; lead: string; steps: (p: Props) => StepItem[] }
> = {
  1: {
    emoji: "⚡",
    heading: "最短で楽しむ",
    lead: "環境を整えてから、おすすめの1本を選びます。上から順に進めてください。",
    steps: ({ listeningEnvironmentArticle, recommendedArticle }) => [
      {
        title: "視聴環境を整える",
        categoryEmoji: "🎧",
        categoryLabel: "視聴環境",
        hint: "暗さ・温度・イヤホン。ここを済ませると、その後が楽になります。",
        article: listeningEnvironmentArticle,
      },
      {
        title: "おすすめ作品を選ぶ",
        hint: "初めての1本は、評価と内容が分かりやすい作品からで大丈夫です。",
        article: recommendedArticle,
      },
    ],
  },
  2: {
    emoji: "🧠",
    heading: "仕組みを理解してから",
    lead: "仕組み → 脳イキ → ドライの順で理解してから、環境と作品へ。上から順に読み進めてください。",
    steps: ({
      mechanismArticle,
      nouIkiArticle,
      dryOrgasmArticle,
      listeningEnvironmentArticle,
      recommendedArticle,
    }) => [
      {
        title: "催眠音声の仕組みを知る",
        hint: "まず「何が起きているか」を短く把握します。",
        article: mechanismArticle,
      },
      {
        title: "脳イキの正体を知る",
        hint: "頭の中で快感が立ち上がる仕組み（トップダウン）を整理します。",
        article: nouIkiArticle,
      },
      {
        title: "ドライオーガズムの正体を知る",
        hint: "射精の区切りを越えた、全身の快感の波を整理します。",
        article: dryOrgasmArticle,
      },
      {
        title: "視聴環境を整える",
        categoryEmoji: "🎧",
        categoryLabel: "視聴環境",
        hint: "理解したうえで、聴く場所とイヤホンをそろえます。",
        article: listeningEnvironmentArticle,
      },
      {
        title: "おすすめ作品を選ぶ",
        hint: "準備ができたら、初めての1本に進みます。",
        article: recommendedArticle,
      },
    ],
  },
};

export function BeginnerGuideClient({
  recommendedArticle,
  listeningEnvironmentArticle,
  mechanismArticle,
  nouIkiArticle,
  dryOrgasmArticle,
}: Props) {
  const [route, setRoute] = useState<RouteId>(1);
  const panelId = useId();
  const panel = ROUTE_PANEL[route];
  const steps = panel.steps({
    recommendedArticle,
    listeningEnvironmentArticle,
    mechanismArticle,
    nouIkiArticle,
    dryOrgasmArticle,
  });

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
          hypnosis audio · beginner guide
        </p>
        <h1
          id={`${panelId}-hero`}
          className="mt-3 whitespace-nowrap text-2xl font-bold tracking-tight text-slate-50 sm:text-4xl"
        >
          催眠音声ビギナーズガイド
        </h1>
        <p className="mt-4 text-balance text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
          「ようこそ、最高の没入体験へ」
        </p>
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
          className={`rounded-2xl border px-4 py-4 text-left transition sm:px-5 sm:py-5 ${
            route === 1
              ? "border-sky-500/50 bg-sky-500/10 ring-1 ring-sky-500/25"
              : "border-slate-600/50 bg-slate-800/40 hover:border-slate-500/60"
          }`}
        >
          <span className="text-xl" aria-hidden>
            ⚡
          </span>
          <span className="mt-2 block text-base font-bold text-slate-50">
            最短で楽しむ
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-slate-400">
            仕組みは後回し。環境 → 作品の2ステップ。
          </span>
        </button>
        <button
          type="button"
          onClick={() => setRoute(2)}
          aria-pressed={route === 2}
          className={`rounded-2xl border px-4 py-4 text-left transition sm:px-5 sm:py-5 ${
            route === 2
              ? "border-sky-500/50 bg-sky-500/10 ring-1 ring-sky-500/25"
              : "border-slate-600/50 bg-slate-800/40 hover:border-slate-500/60"
          }`}
        >
          <span className="text-xl" aria-hidden>
            🧠
          </span>
          <span className="mt-2 block text-base font-bold text-slate-50">
            仕組みから理解する
          </span>
          <span className="mt-1 block text-sm leading-relaxed text-slate-400">
            仕組み → 脳イキ → ドライ → 環境 → 作品の5ステップ。
          </span>
        </button>
      </div>

      <section
        className="mt-8 rounded-2xl border border-slate-600/45 bg-slate-900/35 p-4 sm:p-6"
        role="tabpanel"
        id={`${panelId}-panel`}
        aria-labelledby={`${panelId}-route-${route}`}
        aria-live="polite"
      >
        <h2
          id={`${panelId}-route-${route}`}
          className="flex items-center gap-2 text-lg font-bold text-slate-50 sm:text-xl"
        >
          <span aria-hidden>{panel.emoji}</span>
          {panel.heading}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{panel.lead}</p>
        <BeginnerStepList steps={steps} />
      </section>
    </div>
  );
}
