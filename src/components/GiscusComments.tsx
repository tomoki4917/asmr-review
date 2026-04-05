"use client";

import { useEffect, useRef, useState } from "react";
import {
  type GiscusPublicConfig,
  resolveGiscusConfig,
} from "@/lib/giscus-config";

type Props = {
  /** 記事ごとに一意（例: Markdown の slug） */
  term: string;
};

/**
 * Giscus（GitHub Discussions）埋め込み。
 * 設定は (1) ビルド時の NEXT_PUBLIC_GISCUS_* または (2) 本番の `/giscus-config.json`。
 */
export function GiscusComments({ term }: Props) {
  const ref = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!cfg || !ref.current) return;

    const el = ref.current;
    el.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", cfg.repo);
    script.setAttribute("data-repo-id", cfg.repoId);
    script.setAttribute("data-category", cfg.category);
    script.setAttribute("data-category-id", cfg.categoryId);
    script.setAttribute("data-mapping", "specific");
    script.setAttribute("data-term", `review:${term}`);
    script.setAttribute("data-strict", "1");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "bottom");
    script.setAttribute("data-theme", "dark");
    script.setAttribute("data-lang", "ja");
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [term, cfg]);

  if (cfg === undefined) {
    return (
      <div className="mt-10 rounded-3xl border border-slate-600/45 bg-slate-800/40 px-4 py-10 text-center text-sm text-slate-500 sm:px-6">
        <p>コメント欄を読み込んでいます…</p>
      </div>
    );
  }

  if (!cfg) {
    return (
      <div className="mt-10 rounded-2xl border border-slate-600/45 bg-slate-800/40 px-5 py-8 text-center text-sm text-slate-500">
        <p>コメント（Giscus）は未設定です。</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          管理者向け:{" "}
          <a
            href="https://giscus.app"
            className="text-sky-400 underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            giscus.app
          </a>
          で取得した値を、ビルド前の{" "}
          <code className="mx-1 rounded bg-slate-900 px-1 font-mono">
            NEXT_PUBLIC_GISCUS_*
          </code>
          に設定するか、サイト直下に{" "}
          <code className="mx-1 rounded bg-slate-900 px-1 font-mono">
            giscus-config.json
          </code>
          を配置してください（
          <code className="rounded bg-slate-900 px-1 font-mono text-[10px]">
            public/giscus-config.example.json
          </code>
          を複製）。
        </p>
      </div>
    );
  }

  return (
    <section
      className="mt-10 rounded-3xl border border-slate-600/45 bg-slate-800/40 px-4 py-8 sm:px-6"
      aria-labelledby="giscus-heading"
    >
      <h2
        id="giscus-heading"
        className="text-lg font-bold tracking-tight text-slate-50"
      >
        コメント
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        GitHub アカウントでログインすると投稿できます（外部サービス: Giscus）。
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        コメントの通知は GitHub の通知設定で受け取れます。削除・モデレートは GitHub の
        Discussions 上で行います。
      </p>
      <div ref={ref} className="giscus mt-6 min-h-[120px]" />
    </section>
  );
}
