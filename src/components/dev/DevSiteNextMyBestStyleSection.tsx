import Link from "next/link";
import type { Review } from "@/lib/types";

function Chevron() {
  return (
    <span
      className="shrink-0 text-lg font-light text-slate-500 transition group-hover:text-sky-400/90"
      aria-hidden
    >
      ›
    </span>
  );
}

function CategoryEmoji({ emoji }: { emoji: string }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-lg border border-slate-600/40 bg-slate-900/50 text-[1.25rem] leading-none"
      aria-hidden
    >
      {emoji}
    </span>
  );
}

const CATEGORY_LINKS = [
  {
    emoji: "👑",
    title: "ランキング",
    href: "/?stars=10#reviews-heading",
    subtitle: "★10・並び替え",
  },
  {
    emoji: "🔍",
    title: "作品一覧",
    href: "/#reviews-heading",
    subtitle: "レビュー一覧へ",
  },
  {
    emoji: "🎧",
    title: "視聴環境",
    href: "/reviews/evaluation-method/",
    subtitle: "聴取・解析の前提",
  },
  {
    emoji: "📚",
    title: "知識・コラム",
    href: "/#author-posts-heading",
    subtitle: "解説・用語・記事",
  },
  {
    emoji: "🔰",
    title: "ビギナーズガイド",
    href: "/#hypnosis-intro",
    subtitle: "催眠音声入門",
  },
] as const;

type Props = {
  unknownHypno: Review | undefined;
};

function SearchMagnifierIcon({ className }: { className?: string }) {
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

/** モバイル用：セクションと同系色のピル型検索バー */
function CategoryMobileSearch() {
  return (
    <Link
      href="/#reviews-heading"
      className="group flex items-center gap-3 rounded-full border border-slate-600/50 bg-slate-900/35 px-4 py-3 text-sm text-slate-400 shadow-inner shadow-slate-950/30 ring-1 ring-white/[0.04] transition hover:border-sky-500/35 hover:bg-slate-900/55 hover:text-slate-200 hover:ring-sky-500/10"
    >
      <SearchMagnifierIcon className="h-[1.125rem] w-[1.125rem] shrink-0 text-slate-500 transition group-hover:text-sky-400/80" />
      <span className="truncate">何をお探しですか？</span>
    </Link>
  );
}

/**
 * 開発用 `/dev/site-next/` のみで使用。サイトのダークトーンに合わせた2カラム（狭い幅ではカテゴリを先頭）。
 * カテゴリは狭い幅でもダークトーンのまま、ピル検索＋3列グリッド。lg 以上はサイドバー型リスト。
 */
export function DevSiteNextMyBestStyleSection({ unknownHypno }: Props) {
  const cover = unknownHypno?.coverImage;
  const slug = unknownHypno?.slug ?? "unknown-hypno-daijobu-koe-ni-yudanete";

  return (
    <section
      className="mt-10 rounded-2xl border border-slate-600/45 bg-slate-800/35 px-4 py-8 shadow-lg shadow-slate-950/25 ring-1 ring-sky-900/20 backdrop-blur-md sm:px-6 sm:py-10"
      aria-labelledby="dev-pick-heading"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.92fr)_minmax(0,1fr)] lg:gap-12">
        {/* 運営が選ぶおすすめ（lg では左列・モバイルでは下） */}
        <div className="order-2 min-w-0 lg:order-1">
          <p className="text-sm leading-relaxed text-slate-400">
            実際に商品を購入して自社施設で徹底的に比較・検証
          </p>
          <h2
            id="dev-pick-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-50 sm:text-[1.65rem]"
          >
            運営が選ぶおすすめ
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
            {unknownHypno ? (
              <Link
                href={`/reviews/${slug}/`}
                className="group flex min-h-[5.25rem] items-center gap-3 rounded-xl border border-slate-600/45 bg-slate-800/50 px-3 py-3 shadow-md shadow-slate-950/20 ring-1 ring-white/5 transition hover:border-sky-500/35 hover:bg-slate-800/80 hover:ring-sky-500/15"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 外部 DLsite 表紙 URL */}
                <img
                  src={cover}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 rounded-md border border-slate-600/40 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-snug text-slate-50 group-hover:text-sky-200">
                    アンノウンヒプノ
                  </p>
                  <span className="mt-1.5 inline-block rounded bg-amber-400/95 px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-950 shadow-sm ring-1 ring-amber-500/25">
                    徹底比較
                  </span>
                </div>
                <Chevron />
              </Link>
            ) : (
              <p className="text-sm text-slate-500">
                レビュー「アンノウンヒプノ」のデータが見つかりません（slug:
                unknown-hypno-daijobu-koe-ni-yudanete）。
              </p>
            )}
          </div>
        </div>

        {/* カテゴリ（モバイルでは先頭・lg では右列） */}
        <div className="order-1 min-w-0 lg:order-2 lg:pt-1">
          {/* スマホ：ダーク内パネル＋ピル検索＋3列グリッド（レイアウトは参照、配色はサイト準拠） */}
          <div className="lg:hidden">
            <h2 className="text-lg font-bold tracking-tight text-slate-50">
              カテゴリ
            </h2>
            <nav
              className="mt-3 rounded-2xl border border-slate-600/45 bg-slate-800/40 p-4 pb-4 shadow-md shadow-slate-950/25 ring-1 ring-white/5"
              aria-label="カテゴリから移動"
            >
              <CategoryMobileSearch />
              <ul className="mt-5 grid grid-cols-3 gap-x-2 gap-y-8 px-0.5 sm:gap-x-3">
                {CATEGORY_LINKS.map(({ emoji, title, href }) => (
                  <li key={href} className="min-w-0">
                    <Link
                      href={href}
                      className="group flex min-h-[6rem] flex-col items-center justify-start gap-2.5 rounded-xl px-1.5 py-3 text-center transition hover:bg-slate-700/35 active:bg-slate-700/50"
                    >
                      <span
                        className="flex h-16 w-16 shrink-0 select-none items-center justify-center rounded-2xl border border-slate-600/40 bg-slate-900/45 text-[1.95rem] leading-none shadow-md shadow-slate-950/35 transition group-hover:border-sky-500/35 group-hover:bg-slate-900/65 sm:h-[4.5rem] sm:w-[4.5rem] sm:text-[2.1rem]"
                        aria-hidden
                      >
                        {emoji}
                      </span>
                      <span className="line-clamp-3 text-xs font-semibold leading-snug text-slate-200 group-hover:text-sky-200">
                        {title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/#reviews-heading"
                className="group mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-600/45 bg-slate-900/30 py-3.5 text-sm font-medium text-slate-300 shadow-sm shadow-slate-950/20 transition hover:border-sky-500/30 hover:bg-slate-800/70 hover:text-sky-100"
              >
                すべてを見る
                <span
                  className="inline-block translate-y-px text-[0.65rem] font-light text-slate-500 transition group-hover:text-sky-400/90"
                  aria-hidden
                >
                  ∨
                </span>
              </Link>
            </nav>
          </div>

          {/* PC：サイドバー型リスト */}
          <div className="hidden lg:block">
            <h2 className="text-xl font-bold tracking-tight text-slate-50 sm:text-[1.35rem]">
              カテゴリ
            </h2>
            <ul className="mt-4 divide-y divide-slate-600/40 border-y border-slate-600/45">
              {CATEGORY_LINKS.map(({ emoji, title, href, subtitle }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group flex items-center gap-3 rounded-lg py-3.5 pr-1 transition hover:bg-slate-700/40"
                  >
                    <CategoryEmoji emoji={emoji} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-slate-100 group-hover:text-sky-200">
                        {title}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-slate-500 group-hover:text-slate-400">
                        {subtitle}
                      </p>
                    </div>
                    <Chevron />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
