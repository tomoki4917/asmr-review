"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const STARS = [5, 4, 3, 2, 1] as const;

const SECTION_PSYCHOLOGY = "psychology-insights";
const SECTION_AUTHOR = "author-posts-heading";

function linkClass(active: boolean) {
  return [
    "block rounded-xl px-3 py-2.5 text-sm font-medium transition",
    active
      ? "bg-sky-600 text-white shadow-md shadow-sky-950/25"
      : "text-slate-300 hover:bg-slate-700/70 hover:text-white",
  ].join(" ");
}

function useHashFragment(): string {
  const [hash, setHash] = useState("");

  useEffect(() => {
    const read = () => setHash(window.location.hash.replace(/^#/, ""));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  return hash;
}

export function RatingStarsSidebar() {
  const sp = useSearchParams();
  const current = sp.get("stars");
  const allStarsActive = current === null || current === "";
  const hash = useHashFragment();

  return (
    <nav
      className="space-y-6 rounded-2xl border border-slate-600/45 bg-slate-800/55 p-4 shadow-lg shadow-slate-950/25 backdrop-blur-md"
      aria-label="ページ内メニュー"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/85">
          レビュー評価
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          星の数でレビュー済み作品を絞り込みます。
        </p>
        <ul className="mt-4 space-y-1">
          <li>
            <Link href="/" className={linkClass(allStarsActive)} scroll={false}>
              すべて
            </Link>
          </li>
          {STARS.map((s) => (
            <li key={s}>
              <Link
                href={`/?stars=${s}`}
                className={linkClass(current === String(s))}
                scroll={false}
              >
                <span aria-hidden className="tracking-tight">
                  ★{s}
                </span>
                <span className="sr-only">{s}つ星のレビュー</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/85">
          ページ内へ
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          トップ内の該当セクションへ移動します。
        </p>
        <ul className="mt-4 space-y-1">
          <li>
            <Link
              href={`/#${SECTION_PSYCHOLOGY}`}
              className={linkClass(hash === SECTION_PSYCHOLOGY)}
              scroll={true}
            >
              ビギナー向けおすすめ記事
            </Link>
          </li>
          <li>
            <Link
              href={`/#${SECTION_AUTHOR}`}
              className={linkClass(hash === SECTION_AUTHOR)}
              scroll={true}
            >
              記事
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
