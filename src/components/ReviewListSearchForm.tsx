"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeReviewListSearchQuery } from "@/lib/review-list-search";
import { REVIEWS_LIST_FILTERS_ID } from "@/lib/review-list-href";

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="M20 20l-4.35-4.35" />
    </svg>
  );
}

function buildListHref(basePath: string, sp: URLSearchParams): string {
  const qs = sp.toString();
  const prefix = basePath === "/" ? "/" : basePath.replace(/\/?$/, "/");
  const hash = `#${REVIEWS_LIST_FILTERS_ID}`;
  return qs ? `${prefix}?${qs}${hash}` : `${prefix}${hash}`;
}

type Props = {
  basePath: string;
  className?: string;
};

/** 作品一覧ハブ：キーワード検索（`?q=` と連動） */
export function ReviewListSearchForm({ basePath, className = "" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputId = useId();
  const qFromUrl = normalizeReviewListSearchQuery(searchParams.get("q"));
  const [draft, setDraft] = useState(qFromUrl);

  useEffect(() => {
    setDraft(qFromUrl);
  }, [qFromUrl]);

  const applyQuery = useCallback(
    (nextQ: string) => {
      const p = new URLSearchParams(searchParams.toString());
      const normalized = normalizeReviewListSearchQuery(nextQ);
      if (normalized) p.set("q", normalized);
      else p.delete("q");
      router.push(buildListHref(basePath, p), { scroll: false });
    },
    [basePath, router, searchParams]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyQuery(draft);
  };

  const onClear = () => {
    setDraft("");
    applyQuery("");
  };

  return (
    <section
      className={`rounded-2xl border border-slate-600/45 bg-slate-800/50 px-4 py-4 shadow-md shadow-slate-950/25 ring-1 ring-slate-700/30 sm:px-5 sm:py-4 ${className}`}
      aria-label="キーワード検索"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor={inputId} className="sr-only">
          作品名・タグ・声優名で検索
        </label>
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            id={inputId}
            type="search"
            name="q"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            placeholder="作品名・タグ・声優名で検索"
            autoComplete="off"
            enterKeyHint="search"
            className="min-h-11 w-full rounded-xl border border-slate-600/55 bg-slate-900/75 py-2.5 pl-10 pr-3 text-sm text-slate-100 shadow-inner shadow-slate-950/30 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-500/45 bg-sky-600/25 px-5 text-sm font-semibold text-sky-100 shadow-sm transition hover:border-sky-400/55 hover:bg-sky-600/40 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          >
            検索
          </button>
          {qFromUrl ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600/55 bg-slate-900/60 px-4 text-sm font-medium text-slate-300 transition hover:border-slate-500/65 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500/35"
            >
              クリア
            </button>
          ) : null}
        </div>
      </form>
      {qFromUrl ? (
        <p className="mt-2 text-xs text-slate-500">
          検索中: <span className="font-medium text-slate-300">「{qFromUrl}」</span>
          （絞り込みと併用できます）
        </p>
      ) : null}
    </section>
  );
}
