"use client";

import { useEffect, useState } from "react";
import {
  type GiscusPublicConfig,
  githubDiscussionsUrl,
  resolveGiscusConfig,
} from "@/lib/giscus-config";

/**
 * Giscus コメントは GitHub Discussions 上のデータのため、静的サイトから API 削除は不可（CORS・トークン）。
 * 管理画面から Discussions を開き、GitHub 上で閲覧・削除する導線をまとめる。
 */
export function AdminGiscusPanel() {
  const [cfg, setCfg] = useState<GiscusPublicConfig | null | undefined>(
    undefined
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await resolveGiscusConfig();
      if (!cancelled) setCfg(c);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (cfg === undefined) {
    return (
      <p className="text-sm text-slate-500">コメント設定を確認しています…</p>
    );
  }

  if (!cfg) {
    return (
      <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 text-sm text-amber-100/90">
        <p className="font-medium">Giscus が未設定です</p>
        <p className="mt-2 text-xs leading-relaxed text-amber-200/70">
          記事下のコメントを有効にするには、
          <code className="mx-1 rounded bg-slate-900 px-1 font-mono text-[11px]">
            NEXT_PUBLIC_GISCUS_*
          </code>
          または{" "}
          <code className="rounded bg-slate-900 px-1 font-mono text-[11px]">
            giscus-config.json
          </code>
          を設定してください。
        </p>
      </div>
    );
  }

  const discussionsUrl = githubDiscussionsUrl(cfg.repo);

  return (
    <section className="rounded-2xl border border-slate-600/60 bg-slate-800/50 p-5 shadow-lg sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-sky-100">
        コメント（Giscus）の管理
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        コメントは GitHub Discussions に保存されます。この画面から API
        で一括削除はできません（静的ホスティング・CORS の制約）。GitHub
        を開いて閲覧・編集・削除してください。
      </p>

      <dl className="mt-4 space-y-2 rounded-lg border border-slate-700/60 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <dt className="shrink-0 font-medium text-slate-500">リポジトリ</dt>
          <dd className="font-mono text-slate-300">{cfg.repo}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
          <dt className="shrink-0 font-medium text-slate-500">カテゴリ</dt>
          <dd className="text-slate-300">
            {cfg.category}{" "}
            <span className="text-slate-600">(ID: {cfg.categoryId})</span>
          </dd>
        </div>
      </dl>

      <ul className="mt-5 space-y-3 text-sm">
        {discussionsUrl && (
          <li>
            <a
              href={discussionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-xl bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-500"
            >
              Discussions を開く（一覧・検索）
            </a>
            <p className="mt-1 text-xs text-slate-500">
              各スレッドを開き、右上の「⋯」から編集・削除・ロックができます。
            </p>
          </li>
        )}
        <li>
          <a
            href="https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 underline-offset-2 hover:underline"
          >
            Giscus 高度な使い方（モデレーション等）
          </a>
        </li>
      </ul>
    </section>
  );
}
