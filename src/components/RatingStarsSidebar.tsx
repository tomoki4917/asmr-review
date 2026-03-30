"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const STARS = [5, 4, 3, 2, 1] as const;

const SECTION_AUTHOR = "author-posts-heading";
const SECTION_MECHANISM = "mechanism-heading";

function linkClass(active: boolean) {
  return [
    "block rounded-xl px-3 py-2.5 text-sm font-medium transition",
    active
      ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500"
      : "text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800",
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
      className="space-y-6 rounded-2xl border border-stone-200 bg-white/95 p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900/80"
      aria-label="ページ内メニュー"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          レビュー評価
        </p>
        <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
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
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          記事一覧へ
        </p>
        <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
          トップページ内の該当セクションへ移動します。
        </p>
        <ul className="mt-4 space-y-1">
          <li>
            <Link
              href={`/#${SECTION_AUTHOR}`}
              className={linkClass(hash === SECTION_AUTHOR)}
              scroll={true}
            >
              筆者投稿記事
            </Link>
          </li>
          <li>
            <Link
              href={`/#${SECTION_MECHANISM}`}
              className={linkClass(hash === SECTION_MECHANISM)}
              scroll={true}
            >
              催眠音声のメカニズム
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
