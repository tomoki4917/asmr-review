"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  buildDlsiteRankingBlogpartsConfig,
  DLSITE_RANKING_PERIOD_OPTIONS,
  DEFAULT_DLSITE_RANKING_PERIOD,
  dlsiteSalesRankingDescription,
  dlsiteSalesRankingSectionTitle,
  type DlsiteBlogpartsSite,
  type DlsiteRankingBlogpartsConfig,
  type DlsiteRankingPeriod,
} from "@/lib/dlsite-blogparts";

const BLOGPARTS_SCRIPT_SRC = "https://www.dlsite.com/js/blogparts.js";

type DlsiteJQuery = (
  target: Element | string
) => {
  blogparts: (config: DlsiteRankingBlogpartsConfig) => unknown;
};

declare global {
  interface Window {
    DLsite?: DlsiteJQuery;
    __dlsiteBlogpartsScriptPromise?: Promise<void>;
  }
}

function loadDlsiteBlogpartsScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("blogparts requires a browser"));
  }

  if (window.DLsite) {
    return Promise.resolve();
  }

  if (window.__dlsiteBlogpartsScriptPromise) {
    return window.__dlsiteBlogpartsScriptPromise;
  }

  window.__dlsiteBlogpartsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${BLOGPARTS_SCRIPT_SRC}"]`
    );

    if (existing) {
      if (window.DLsite) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("DLsite blogparts.js failed to load")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = BLOGPARTS_SCRIPT_SRC;
    script.charset = "UTF-8";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("DLsite blogparts.js failed to load"));
    document.head.appendChild(script);
  });

  return window.__dlsiteBlogpartsScriptPromise;
}

function renderRankingIntoMount(
  mount: HTMLDivElement,
  config: DlsiteRankingBlogpartsConfig
) {
  const DLsite = window.DLsite;
  if (!DLsite) {
    throw new Error("DLsite is not available after blogparts.js loaded");
  }

  mount.replaceChildren();
  DLsite(mount).blogparts(config);
}

type Props = {
  /** DLsite ランキングのサイト軸（home＝全年齢 / maniax＝18禁同人） */
  site?: DlsiteBlogpartsSite;
  /** 表示件数（maniax 公式タグは 3、home は 5） */
  count?: number;
  className?: string;
};

/**
 * DLsite 公式ブログパーツ（ランキング・縦表示）。
 * 公式タグは `document.writeln` 前提のため、マウント要素へ手動で blogparts を呼ぶ。
 */
export function DlsiteRankingSidebar({
  site = "maniax",
  count,
  className = "",
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const selectId = useId();
  const [period, setPeriod] = useState<DlsiteRankingPeriod>(
    DEFAULT_DLSITE_RANKING_PERIOD
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const description = dlsiteSalesRankingDescription(period);
  const sectionTitle = dlsiteSalesRankingSectionTitle(site);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    setLoadError(null);

    const config = buildDlsiteRankingBlogpartsConfig({
      period,
      site,
      count: count ?? (site === "maniax" ? 3 : 5),
    });

    loadDlsiteBlogpartsScript()
      .then(() => {
        if (cancelled || !mountRef.current) return;
        renderRankingIntoMount(mountRef.current, config);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "ランキングの読み込みに失敗しました";
        setLoadError(message);
      });

    return () => {
      cancelled = true;
      mount.replaceChildren();
    };
  }, [period, site, count]);

  return (
    <aside className={`min-w-0 ${className}`.trim()}>
      <header className="border-t border-slate-500/70 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl font-bold tracking-tight text-slate-50 sm:text-[1.35rem]">
            {sectionTitle}
          </h2>
          <label htmlFor={selectId} className="sr-only">
            ランキングの集計期間
          </label>
          <select
            id={selectId}
            value={period}
            onChange={(e) =>
              setPeriod(e.target.value as DlsiteRankingPeriod)
            }
            className="max-w-full rounded-md border border-slate-600/80 bg-slate-800/90 px-2 py-1.5 text-xs font-medium text-slate-200 shadow-sm outline-none transition focus-visible:border-sky-500/60 focus-visible:ring-2 focus-visible:ring-sky-500/30"
          >
            {DLSITE_RANKING_PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </header>
      <p className="mt-2 text-pretty text-xs leading-relaxed text-slate-500">
        {description}
      </p>
      {loadError ? (
        <p className="mt-4 text-pretty text-sm text-amber-200/90" role="alert">
          {loadError}
        </p>
      ) : null}
      <div
        ref={mountRef}
        className="dlsite-ranking-blogparts mt-4 min-h-[12rem] overflow-x-auto"
        aria-live="polite"
      />
    </aside>
  );
}
