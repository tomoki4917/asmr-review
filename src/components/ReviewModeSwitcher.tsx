"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type Props = {
  quickTitle: string;
  detailTitle: string;
  quickAffiliateHref: string;
  quickDiscountLabel: string;
  quickIsOnSale: boolean;
  children: ReactNode;
};

export function ReviewModeSwitcher({
  quickTitle,
  detailTitle,
  quickAffiliateHref,
  quickDiscountLabel,
  quickIsOnSale,
  children,
}: Props) {
  const [mode, setMode] = useState<"quick" | "detail">("quick");
  const showQuick = mode === "quick";

  return (
    <div className="mt-8 sm:mt-9">
      <section className="rounded-2xl border border-slate-600/45 bg-slate-900/45 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300/90">
          記事モード
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("quick")}
            aria-pressed={showQuick}
            className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
              showQuick
                ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                : "border-slate-600/60 bg-slate-800/60 text-slate-200 hover:border-slate-500/70 hover:bg-slate-800/80"
            }`}
          >
            {quickTitle}
          </button>
          <button
            type="button"
            onClick={() => setMode("detail")}
            aria-pressed={!showQuick}
            className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
              !showQuick
                ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                : "border-slate-600/60 bg-slate-800/60 text-slate-200 hover:border-slate-500/70 hover:bg-slate-800/80"
            }`}
          >
            {detailTitle}
          </button>
        </div>
      </section>

      {showQuick ? (
        <section className="review-mode-quick mt-4 rounded-2xl border border-slate-600/45 bg-slate-900/50 p-4 sm:p-5">
          <h3 className="mb-3 inline-flex scroll-mt-24 items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-lg font-bold tracking-tight leading-snug text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.22)] sm:text-xl">
            <span aria-hidden className="text-xl leading-none">
              ⚡️
            </span>
            1分で判断！クイック解析
          </h3>

          <div className="mt-4 space-y-2 rounded-xl border border-slate-700/60 bg-slate-950/45 p-3.5 sm:p-4">
            <p className="text-sm font-semibold text-slate-100">
              <span className="text-amber-300">★</span> 総合スコア：9.0 / 10
            </p>
            <p className="text-sm leading-relaxed text-slate-200">
              一言で： 「先輩後輩ドラマで関係を固め、はい／いいえの質問反復とトリガーで恋ドレイ化へ連れていく約163分のマインドコントロール」
            </p>
          </div>

          <div className="mt-5">
            <h3 className="text-base font-bold tracking-tight text-sky-200 sm:text-lg">【スペック表】</h3>
            <ul
              className="mt-3 list-none space-y-2.5 rounded-xl border border-slate-600/70 bg-gradient-to-br from-slate-950/95 via-slate-900/92 to-slate-950/95 px-3.5 py-3.5 text-sm font-semibold leading-snug text-slate-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] sm:px-4 sm:py-4"
              aria-label="視聴前提の要点"
            >
              <li className="border-l-[3px] border-slate-500/90 pl-3.5">
                ・<span className="text-slate-100">誘導タイプ：</span>{" "}
                <span className="text-slate-50">洗脳系 / 服従・支配系 / 反復刷り込み系</span>
              </li>
              <li className="border-l-[3px] border-slate-500/90 pl-3.5">
                ・<span className="text-slate-100">声質　　　：</span>{" "}
                <span className="text-slate-50">お姉さん系 / ウィスパー系</span>
              </li>
              <li className="border-l-[3px] border-slate-500/90 pl-3.5">
                ・<span className="text-slate-100">テンポ　　：</span>{" "}
                <span className="text-slate-50">ややゆっくり / 断続系（間が多い）</span>
              </li>
              <li className="border-l-[3px] border-slate-500/90 pl-3.5">
                ・主要フェチ： 主従関係 / 言葉責め / 耳舐め / 乳首責め / 前立腺責め
              </li>
              <li className="border-l-[3px] border-slate-500/90 pl-3.5">
                ・性癖タイプ： M推奨
              </li>
              <li className="border-l-[3px] border-slate-500/90 pl-3.5">
                ・おすすめ催眠Lv：初中級（中程度トランス＋暗示受容）
              </li>
              <li className="border-l-[3px] border-slate-500/90 pl-3.5">
                ・<span className="text-slate-100">収録時間　：</span>{" "}
                <span className="text-slate-50">約163分（バイノーラル）</span>
              </li>
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="text-base font-bold tracking-tight text-emerald-200 sm:text-lg">【こんな人におすすめ】</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-200">
              <li>・「はい／いいえ」だけで思考を放棄したい</li>
              <li>・長い時間をかけてじっくり堕とされたい</li>
              <li>・特定の合図で体が反応する感覚（トリガー）を味わいたい</li>
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="text-base font-bold tracking-tight text-rose-200 sm:text-lg">【合わない可能性がある人】</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-200">
              <li>・短時間でパッと済ませたい</li>
              <li>・命令されるのが苦手、対等な関係がいい</li>
            </ul>
          </div>

          <div className="mt-6">
            {quickIsOnSale ? (
              <p className="mb-2 inline-flex items-center rounded-md border border-rose-300/50 bg-rose-500/20 px-2.5 py-1 text-xs font-bold tracking-wide text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.28)]">
                セール中
              </p>
            ) : null}
            <a
              href={quickAffiliateHref}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className={`inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                quickIsOnSale
                  ? "border-rose-300/60 bg-gradient-to-r from-rose-600/65 via-orange-500/55 to-amber-500/55 text-white shadow-[0_0_24px_rgba(251,113,133,0.35)] hover:brightness-110 focus-visible:outline-rose-300/70"
                  : "border-sky-500/40 bg-sky-600/25 text-sky-100 hover:bg-sky-600/35 focus-visible:outline-sky-400/60"
              }`}
            >
              ➡ DLsiteで作品をチェックする（{quickDiscountLabel}）
            </a>
          </div>
        </section>
      ) : (
        <>{children}</>
      )}
    </div>
  );
}
