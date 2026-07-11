import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site-brand";

export const metadata: Metadata = {
  title: "はじめての方へ",
  description: `${SITE_NAME}の使い方・催眠音声の入門・視聴環境・評価メソッドへの導線をまとめています。`,
  alternates: { canonical: "/start/" },
};

type HubCard = {
  emoji: string;
  title: string;
  description: string;
  href: string;
};

const HUB_CARDS: HubCard[] = [
  {
    emoji: "🏠",
    title: "サイトについて",
    description: "運営者・採点方針・アフィリエイトの考え方",
    href: "/about/",
  },
  {
    emoji: "🔰",
    title: "催眠音声ビギナーズガイド",
    description: "初めての方向けの入門記事とおすすめ作品",
    href: "/beginner/",
  },
  {
    emoji: "🎧",
    title: "視聴環境の整え方",
    description: "部屋・イヤホン・バイノーラルの基本セットアップ",
    href: "/listening-environment/",
  },
  {
    emoji: "📊",
    title: "評価メソッド",
    description: "レビューの採点手順と根拠（WhisperX・音響解析など）",
    href: "/evaluation-method/",
  },
];

export default function StartHubPage() {
  return (
    <main className="mx-auto w-full max-w-3xl py-10 sm:py-14">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200"
      >
        <span aria-hidden>←</span> トップへ
      </Link>

      <header className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400/90">
          getting started
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          はじめての方へ
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">
          {SITE_NAME}を初めて訪れた方は、こちらからお読みください。サイトの考え方・入門記事・視聴環境・採点基準への導線をまとめています。
        </p>
      </header>

      <ul className="mt-10 space-y-4">
        {HUB_CARDS.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="group flex min-h-[4.75rem] gap-4 rounded-2xl border border-slate-600/45 bg-slate-800/40 p-4 shadow-md shadow-slate-950/20 ring-1 ring-white/5 transition hover:border-sky-500/35 hover:bg-slate-800/60 active:bg-slate-800/70 sm:p-5"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-600/40 bg-slate-900/50 text-2xl"
                aria-hidden
              >
                {card.emoji}
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-50 group-hover:text-sky-200">
                  {card.title}
                </h2>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-slate-400 sm:text-sm">
                  {card.description}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
