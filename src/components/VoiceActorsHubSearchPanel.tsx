"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { VoiceActorHubEntry } from "@/lib/review-voice-actors";
import {
  parseKanaRowId,
  VOICE_ACTOR_KANA_ROWS,
  type KanaRowId,
} from "@/lib/voice-actor-kana-rows";
import { VOICE_ACTOR_TONE_LABELS, type VoiceActorToneId } from "@/lib/voice-actor-tone";
import {
  buildReviewListHref,
  type ReviewListHrefOptions,
} from "@/lib/review-list-href";

const TONE_IDS: VoiceActorToneId[] = ["ama", "ds", "dm"];

const KANA_ROW_SELECT_CLASS =
  "mt-2 min-h-9 w-full rounded-lg border border-slate-600/60 bg-slate-900/70 px-2.5 py-1.5 text-sm font-medium text-slate-100 shadow-sm shadow-slate-950/20 outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30";

type Props = {
  voiceActors: VoiceActorHubEntry[];
  featuredTitleBySlug: Record<string, string>;
  listBasePath: string;
};

export function VoiceActorsHubSearchPanel({
  voiceActors,
  featuredTitleBySlug,
  listBasePath,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rowFromUrl = parseKanaRowId(searchParams.get("gyo"));
  const [activeRow, setActiveRow] = useState<KanaRowId | null>(rowFromUrl);

  useEffect(() => {
    setActiveRow(parseKanaRowId(searchParams.get("gyo")));
  }, [searchParams]);

  const listOpts = (extra: ReviewListHrefOptions = {}) =>
    buildReviewListHref(listBasePath, extra);

  const setRowFilter = useCallback(
    (rowId: KanaRowId | null) => {
      setActiveRow(rowId);
      const p = new URLSearchParams(searchParams.toString());
      if (rowId) p.set("gyo", rowId);
      else p.delete("gyo");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const filtered = useMemo(() => {
    if (!activeRow) return voiceActors;
    const matched = voiceActors.filter((v) => v.kanaRowId === activeRow);
    const other = voiceActors.filter((v) => v.kanaRowId == null);
    return { matched, other, hasFilter: true as const };
  }, [voiceActors, activeRow]);

  const list =
    activeRow && typeof filtered === "object" && "matched" in filtered
      ? filtered.matched
      : voiceActors;

  const otherList =
    activeRow && typeof filtered === "object" && "other" in filtered
      ? filtered.other
      : [];

  const activeLabel = activeRow
    ? VOICE_ACTOR_KANA_ROWS.find((r) => r.id === activeRow)?.label
    : null;

  return (
    <section
      className="mt-8 overflow-hidden rounded-lg border border-slate-500/75 bg-slate-900/25 shadow-sm shadow-slate-950/30"
      aria-label="声優名と系統から探す"
    >
      <div className="h-0.5 bg-violet-500/80" aria-hidden />

      <div className="grid grid-cols-[minmax(6.75rem,8.25rem)_1fr] items-start gap-4 p-4 sm:gap-6 sm:p-5">
        <div className="min-w-0" aria-labelledby="voice-actor-name-search">
          <h2
            id="voice-actor-name-search"
            className="text-sm font-bold tracking-tight text-slate-50"
          >
            声優名から探す
          </h2>
          <label htmlFor="voice-actor-kana-row" className="sr-only">
            五十音行で絞り込み
          </label>
          <select
            id="voice-actor-kana-row"
            className={KANA_ROW_SELECT_CLASS}
            value={activeRow ?? ""}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setRowFilter(v === "" ? null : parseKanaRowId(v));
            }}
            aria-label="五十音行で絞り込み"
          >
            <option value="">すべての行</option>
            {VOICE_ACTOR_KANA_ROWS.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
          {activeLabel ? (
            <p className="mt-2 text-[11px] text-slate-500">
              {activeLabel}（{list.length}件）
            </p>
          ) : null}
          {list.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              該当する声優がありません。別の行を選ぶか「すべての行」を選んでください。
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {list.map(({ name, slug, featuredSlugs }) => (
                <li key={slug}>
                  <Link
                    href={listOpts({ voice: name })}
                    className="block text-sm leading-snug text-slate-200 underline-offset-4 transition hover:text-sky-200 hover:underline"
                  >
                    {name}
                  </Link>
                  {featuredSlugs.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {featuredSlugs.map((featSlug) => {
                        const title = featuredTitleBySlug[featSlug];
                        if (!title) return null;
                        return (
                          <li key={featSlug}>
                            <Link
                              href={`/reviews/${featSlug}/`}
                              className="text-[11px] leading-snug text-sky-300/85 underline-offset-2 hover:text-sky-200 hover:underline"
                            >
                              おすすめ
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {otherList.length > 0 ? (
            <div className="mt-4 border-t border-slate-600/35 pt-3">
              <p className="text-[10px] font-medium text-slate-500">
                五十音で分類できない名前
              </p>
              <ul className="mt-2 space-y-2">
                {otherList.map(({ name, slug, featuredSlugs }) => (
                  <li key={slug}>
                    <Link
                      href={listOpts({ voice: name })}
                      className="block text-sm leading-snug text-slate-400 underline-offset-4 hover:text-sky-200 hover:underline"
                    >
                      {name}
                    </Link>
                    {featuredSlugs.length > 0 ? (
                      <ul className="mt-1 space-y-0.5">
                        {featuredSlugs.map((featSlug) => (
                          <li key={featSlug}>
                            <Link
                              href={`/reviews/${featSlug}/`}
                              className="text-[11px] text-sky-300/75 hover:underline"
                            >
                              おすすめ
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <nav className="min-w-0" aria-label="系統から探す">
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {TONE_IDS.map((toneId) => (
              <Link
                key={toneId}
                href={listOpts({ tone: toneId })}
                className="group flex flex-col items-center gap-2 text-center"
              >
                <span
                  className="aspect-square w-full max-w-[5.25rem] rounded-sm border-2 border-slate-500/80 bg-slate-900/40 transition group-hover:border-sky-500/45 group-hover:bg-slate-800/55 sm:max-w-none"
                  aria-hidden
                />
                <span className="text-[11px] font-semibold leading-tight text-slate-200 group-hover:text-sky-200 sm:text-xs">
                  {VOICE_ACTOR_TONE_LABELS[toneId]}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </section>
  );
}
