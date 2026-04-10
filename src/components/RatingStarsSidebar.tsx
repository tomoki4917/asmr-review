"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const STAR_FILTERS = [
  { param: "10", label: "★10", sr: "10点" },
  { param: "9", label: "★9", sr: "9点" },
  { param: "8", label: "★8", sr: "8点" },
  { param: "7", label: "★7", sr: "7点" },
  { param: "6", label: "★6", sr: "6点" },
  { param: "lte5", label: "★5〜", sr: "5点以下" },
] as const;

export type ReviewStarFilterCounts = Record<
  (typeof STAR_FILTERS)[number]["param"],
  number
>;

const SECTION_HYPNOSIS_INTRO = "hypnosis-intro";
const SECTION_AUTHOR = "author-posts-heading";

function buildHomeHref(opts: {
  genre?: string | null;
  stars?: string | null;
  clearStars?: boolean;
  sort?: "new" | "old";
}) {
  const p = new URLSearchParams();
  if (opts.genre) p.set("genre", opts.genre);
  if (opts.clearStars) {
    // stars omitted
  } else if (opts.stars != null && opts.stars !== "") {
    p.set("stars", opts.stars);
  }
  if (opts.sort === "old") p.set("sort", "old");
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

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

type Props = {
  starCounts: ReviewStarFilterCounts;
  sortOrder: "new" | "old";
};

export function RatingStarsSidebar({ starCounts, sortOrder }: Props) {
  const sp = useSearchParams();
  const currentStars = sp.get("stars");
  const genreRaw = sp.get("genre");
  const genre =
    genreRaw === "hypnosis" || genreRaw === "doujin" ? genreRaw : null;

  const allStarsActive = currentStars === null || currentStars === "";
  const allGenreActive = genre === null;

  const showStarFilters =
    genre === "hypnosis" || genre === "doujin" || currentStars != null;

  const hash = useHashFragment();

  return (
    <nav
      className="space-y-6 rounded-2xl border border-slate-600/45 bg-slate-800/55 p-4 shadow-lg shadow-slate-950/25 backdrop-blur-md"
      aria-label="ページ内メニュー"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/85">
          レビュー項目
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          ジャンルを選ぶと、その下に評価（★10〜★5〜）で絞り込めます。
        </p>
        <ul className="mt-4 space-y-1">
          <li>
            <Link
              href={buildHomeHref({
                stars: currentStars ?? undefined,
                sort: sortOrder,
              })}
              className={linkClass(allGenreActive)}
              scroll={false}
            >
              すべて
            </Link>
          </li>
          <li>
            <Link
              href={buildHomeHref({ genre: "hypnosis", sort: sortOrder })}
              className={linkClass(genre === "hypnosis")}
              scroll={false}
            >
              催眠音声
            </Link>
          </li>
          <li>
            <Link
              href={buildHomeHref({ genre: "doujin", sort: sortOrder })}
              className={linkClass(genre === "doujin")}
              scroll={false}
            >
              同人音声
            </Link>
          </li>
        </ul>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-sky-400/85">
          並び順
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          投稿日（公開日）を基準に一覧を並べます。
        </p>
        <ul className="mt-3 space-y-1">
          <li>
            <Link
              href={buildHomeHref({
                genre: genre ?? undefined,
                stars: currentStars ?? undefined,
                sort: "new",
              })}
              className={linkClass(sortOrder === "new")}
              scroll={false}
            >
              新しい順
            </Link>
          </li>
          <li>
            <Link
              href={buildHomeHref({
                genre: genre ?? undefined,
                stars: currentStars ?? undefined,
                sort: "old",
              })}
              className={linkClass(sortOrder === "old")}
              scroll={false}
            >
              古い順
            </Link>
          </li>
        </ul>
      </div>

      {showStarFilters ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/85">
            レビュー評価
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            10 段階に換算した点数でレビュー済み作品を絞り込みます。
          </p>
          <ul className="mt-4 space-y-1">
            <li>
              <Link
                href={
                  genre
                    ? buildHomeHref({
                        genre,
                        clearStars: true,
                        sort: sortOrder,
                      })
                    : buildHomeHref({ clearStars: true, sort: sortOrder })
                }
                className={linkClass(allStarsActive)}
                scroll={false}
              >
                すべて
              </Link>
            </li>
            {STAR_FILTERS.map((f) => {
              const active = currentStars === f.param;
              const n = starCounts[f.param];
              return (
                <li key={f.param}>
                  <Link
                    href={buildHomeHref({
                      genre: genre ?? undefined,
                      stars: f.param,
                      sort: sortOrder,
                    })}
                    className={`${linkClass(active)} flex items-stretch`}
                    scroll={false}
                  >
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span aria-hidden className="tracking-tight">
                          {f.label}
                        </span>
                        <span className="sr-only">
                          {f.sr}のレビュー、{n}件
                        </span>
                      </span>
                      <span
                        className={
                          active
                            ? "shrink-0 tabular-nums text-xs text-white/90"
                            : "shrink-0 tabular-nums text-xs text-slate-400"
                        }
                        aria-hidden
                      >
                        {n}件
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-600/40 bg-slate-900/30 px-3 py-3 text-xs leading-relaxed text-slate-500">
          「催眠音声」または「同人音声」を選ぶと、評価の一覧が表示されます。
        </p>
      )}

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
              href={`/#${SECTION_HYPNOSIS_INTRO}`}
              className={linkClass(hash === SECTION_HYPNOSIS_INTRO)}
              scroll={true}
            >
              催眠音声入門
            </Link>
          </li>
          <li>
            <Link
              href={`/#${SECTION_AUTHOR}`}
              className={linkClass(hash === SECTION_AUTHOR)}
              scroll={true}
            >
              記事一覧
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
