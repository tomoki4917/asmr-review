"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ReviewMarkdown } from "@/components/ReviewMarkdown";
import { linkifyPlainTextUrls } from "@/lib/linkify-plain-text-urls";

type Props = {
  quickTitle: string;
  detailTitle: string;
  quickAffiliateHref: string;
  quickDiscountLabel: string;
  quickIsOnSale: boolean;
  quickSampleHref?: string;
  quickScoreLabel: string;
  quickDryWetCounts?: string;
  quickOneLine: string;
  /** クイック【スペック表】先頭。`YYYY-MM-DD` をサイト側で整形済みの表示文字列 */
  quickSaleDate: string;
  /** クイック【スペック表】2行目 */
  quickCircleName: string;
  /** スペック表のラベル（催眠既定: 誘導タイプ / 同人: シチュエーション） */
  quickTypeLabel?: string;
  quickInductionType: string;
  quickVoiceActor: string;
  quickMajorFetish: string;
  quickKinkType: string;
  quickRecommendedLevel?: string;
  /** 同人など催眠Lvを出さないレビューでは false */
  quickShowRecommendedLevel?: boolean;
  quickRecording: string;
  quickRecommendedFor: string[];
  quickNotRecommendedFor: string[];
  /** クイックのみの「作品感想」段落（見出しはコンポーネント側で付与） */
  quickWorkImpressionParagraphs?: string[];
  quickWorkImpressionAvatar?: string;
  /** 記事モード「解析データ」タブ（誘導・暗示の表ブロック） */
  analysisDataMarkdown?: string;
  /** 詳細の `### 体験感度Lv（一覧）` へ誘導するリンクを「おすすめ催眠Lv」直後に出す */
  quickShowSensitivityLevelListLink?: boolean;
  children: ReactNode;
};

const EXPERIENCE_SENSITIVITY_LV_LIST_ID = "experience-sensitivity-lv-list";

/** 記事モード「作品詳細解析」ボタン・見出しの既定文言 */
export const REVIEW_DETAIL_MODE_BUTTON_LABEL = "しっかり見たい人向け！作品詳細解析";

function ModeButtonLabel({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "center";
}) {
  return (
    <span
      className={`block whitespace-pre-line leading-snug ${
        align === "center" ? "text-center" : "text-left"
      }`}
    >
      {label}
    </span>
  );
}

export function ReviewModeSwitcher({
  quickTitle,
  detailTitle,
  quickAffiliateHref,
  quickDiscountLabel,
  quickIsOnSale,
  quickSampleHref,
  quickScoreLabel,
  quickDryWetCounts,
  quickOneLine,
  quickSaleDate,
  quickCircleName,
  quickTypeLabel = "誘導タイプ",
  quickInductionType,
  quickVoiceActor,
  quickMajorFetish,
  quickKinkType,
  quickRecommendedLevel = "",
  quickShowRecommendedLevel = true,
  quickRecording,
  quickRecommendedFor,
  quickNotRecommendedFor,
  quickWorkImpressionParagraphs,
  quickWorkImpressionAvatar,
  analysisDataMarkdown,
  quickShowSensitivityLevelListLink = false,
  children,
}: Props) {
  const [mode, setMode] = useState<"quick" | "detail" | "data">("quick");
  const hasAnalysisData = Boolean(analysisDataMarkdown?.trim());

  function openDetailAndScrollToSensitivityList() {
    setMode("detail");
    window.setTimeout(() => {
      document.getElementById(EXPERIENCE_SENSITIVITY_LV_LIST_ID)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }
  const showQuick = mode === "quick";
  const showDetail = mode === "detail";
  const showData = mode === "data";
  const hasVoiceActor = quickVoiceActor.trim().length > 0 && !/確認中|未設定|不明/.test(quickVoiceActor);
  const showSampleLink =
    Boolean(quickSampleHref) &&
    hasVoiceActor;

  return (
    <div className="mt-8 sm:mt-9">
      <section className="rounded-2xl border border-slate-600/45 bg-slate-900/45 p-4 sm:p-5">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-sky-300/90">
          記事モード
        </p>
        <div
          className={`mt-3 grid grid-cols-1 gap-2 ${
            hasAnalysisData ? "sm:grid-cols-3" : "sm:grid-cols-2"
          }`}
        >
          <button
            type="button"
            onClick={() => setMode("quick")}
            aria-pressed={showQuick}
            className={`flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              showQuick
                ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                : "border-slate-600/60 bg-slate-800/60 text-slate-200 hover:border-slate-500/70 hover:bg-slate-800/80"
            }`}
          >
            <ModeButtonLabel label={quickTitle} align="center" />
          </button>
          <button
            type="button"
            onClick={() => setMode("detail")}
            aria-pressed={showDetail}
            className={`flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              showDetail
                ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                : "border-slate-600/60 bg-slate-800/60 text-slate-200 hover:border-slate-500/70 hover:bg-slate-800/80"
            }`}
          >
            <ModeButtonLabel label={detailTitle} align="center" />
          </button>
          {hasAnalysisData ? (
            <button
              type="button"
              onClick={() => setMode("data")}
              aria-pressed={showData}
              className={`flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                showData
                  ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                  : "border-slate-600/60 bg-slate-800/60 text-slate-200 hover:border-slate-500/70 hover:bg-slate-800/80"
              }`}
            >
              <ModeButtonLabel label="解析データ" align="center" />
            </button>
          ) : null}
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
              <span className="text-amber-300">★</span> 総合スコア：{quickScoreLabel}
            </p>
            {quickDryWetCounts ? (
              <p className="text-sm font-semibold text-slate-200">{quickDryWetCounts}</p>
            ) : null}
            <p className="text-sm leading-relaxed text-slate-200">
              「{quickOneLine}」
            </p>
          </div>

          <div className="mt-5">
            <h3 className="text-base font-bold tracking-tight text-sky-200 sm:text-lg">【スペック表】</h3>
            <ul
              className="mt-3 list-none space-y-2 rounded-xl border border-slate-600/70 bg-gradient-to-br from-slate-950/95 via-slate-900/92 to-slate-950/95 px-3 py-3 text-[0.92rem] font-semibold leading-[1.55] text-slate-50 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] sm:space-y-2.5 sm:px-4 sm:py-4 sm:text-sm sm:leading-snug"
              aria-label="視聴前提の要点"
            >
              <li className="border-l-[3px] border-slate-500/90 pl-3">
                <span className="text-slate-100">販売日：</span>{" "}
                <span className="text-slate-50">{quickSaleDate}</span>
              </li>
              <li className="border-l-[3px] border-slate-500/90 pl-3">
                <span className="text-slate-100">サークル：</span>{" "}
                <span className="text-slate-50">{quickCircleName}</span>
              </li>
              <li className="border-l-[3px] border-slate-500/90 pl-3">
                <span className="text-slate-100">{quickTypeLabel}：</span>{" "}
                <span className="text-slate-50">{quickInductionType}</span>
              </li>
              {hasVoiceActor ? (
                <li className="border-l-[3px] border-slate-500/90 pl-3">
                  <span className="text-slate-100">声優：</span>{" "}
                  <span className="text-slate-50">{quickVoiceActor}</span>
                  {showSampleLink ? (
                    <>
                      <span className="px-1 text-slate-400">・</span>
                      <a
                        href={quickSampleHref}
                        target="_blank"
                        rel="nofollow sponsored noopener noreferrer"
                        className="text-sky-300 underline decoration-sky-500/60 underline-offset-2 transition hover:text-sky-200"
                      >
                        音声サンプルはこちら
                      </a>
                    </>
                  ) : null}
                </li>
              ) : null}
              <li className="border-l-[3px] border-slate-500/90 pl-3">
                主要フェチ： {quickMajorFetish}
              </li>
              <li className="border-l-[3px] border-slate-500/90 pl-3">
                性癖タイプ： {quickKinkType}
              </li>
              {quickShowRecommendedLevel ? (
                <li className="border-l-[3px] border-slate-500/90 pl-3">
                  <span className="text-slate-100">おすすめ催眠Lv：</span>
                  <span className="text-slate-50">{quickRecommendedLevel}</span>
                  {quickShowSensitivityLevelListLink ? (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={openDetailAndScrollToSensitivityList}
                        className="text-sky-300 underline decoration-sky-500/60 underline-offset-2 transition hover:text-sky-200"
                      >
                        レベル一覧表はこちら
                      </button>
                    </>
                  ) : null}
                </li>
              ) : null}
              <li className="border-l-[3px] border-slate-500/90 pl-3">
                <span className="text-slate-100">収録時間：</span>{" "}
                <span className="text-slate-50">{quickRecording}</span>
              </li>
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="text-base font-bold tracking-tight text-emerald-200 sm:text-lg">【こんな人におすすめ】</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-200">
              {quickRecommendedFor.map((row) => (
                <li key={row}>・{row}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <h3 className="text-base font-bold tracking-tight text-rose-200 sm:text-lg">【合わない可能性がある人】</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-200">
              {quickNotRecommendedFor.map((row) => (
                <li key={row}>・{row}</li>
              ))}
            </ul>
          </div>

          {quickWorkImpressionParagraphs?.length ? (
            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <h3 className="text-base font-bold tracking-tight text-amber-100 sm:text-lg">作品感想</h3>
                {quickWorkImpressionAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- レビュー同梱の相対パス
                  <img
                    src={quickWorkImpressionAvatar}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full border-2 border-slate-500/55 bg-slate-800/80 object-cover shadow-[0_1px_8px_rgba(0,0,0,0.4)] sm:h-9 sm:w-9"
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </div>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-200">
                {quickWorkImpressionParagraphs.map((paragraph) => (
                  <p key={paragraph}>{linkifyPlainTextUrls(paragraph)}</p>
                ))}
              </div>
            </div>
          ) : null}

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
      ) : showData ? (
        <section className="review-mode-data mt-4 rounded-2xl border border-slate-600/45 bg-slate-900/50 p-4 sm:p-5">
          <h3 className="mb-3 inline-flex scroll-mt-24 items-center gap-2 rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-lg font-bold tracking-tight leading-snug text-violet-100 shadow-[0_0_18px_rgba(167,139,250,0.22)] sm:text-xl">
            <span aria-hidden className="text-xl leading-none">
              📊
            </span>
            解析データ
          </h3>
          <div className="review-md review-reading mt-2 min-w-0 text-sm leading-relaxed text-slate-200 sm:text-[0.94rem]">
            <ReviewMarkdown markdown={analysisDataMarkdown ?? ""} starReviewReadingComfort />
          </div>
        </section>
      ) : (
        <>{children}</>
      )}
    </div>
  );
}
