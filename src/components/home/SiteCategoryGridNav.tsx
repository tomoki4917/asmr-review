import Link from "next/link";
import type { SiteCategoryLink } from "@/lib/site-category-links";

type Props = {
  items: SiteCategoryLink[];
  /** 「全て見る」リンク（省略可） */
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
};

/** 3×3 絵文字カテゴリ（次サイト草案・全年齢トップ共通） */
export function SiteCategoryGridNav({
  items,
  viewAllHref,
  viewAllLabel = "全て見る",
  className = "",
}: Props) {
  return (
    <nav
      className={`rounded-2xl border border-slate-600/45 bg-slate-800/40 p-4 shadow-md shadow-slate-950/25 ring-1 ring-white/5 ${className}`}
      aria-label="カテゴリから移動"
    >
      <ul className="grid auto-rows-fr grid-cols-3 gap-x-2 gap-y-6 px-0.5 sm:gap-x-3 sm:gap-y-7">
        {items.map(({ emoji, title, href, mobileTitleLines }) => (
          <li key={href + title} className="flex min-w-0">
            <Link
              href={href}
              className="group flex h-full min-h-[6.75rem] w-full flex-col items-center justify-start gap-2 rounded-xl px-1 py-2.5 text-center transition hover:bg-slate-700/35 active:bg-slate-700/50"
            >
              <span
                className="flex h-14 w-14 shrink-0 select-none items-center justify-center rounded-2xl border border-slate-600/40 bg-slate-900/45 text-[1.65rem] leading-none shadow-md shadow-slate-950/35 transition group-hover:border-sky-500/35 group-hover:bg-slate-900/65 sm:h-16 sm:w-16 sm:text-[1.95rem]"
                aria-hidden
              >
                {emoji}
              </span>
              <span className="flex min-h-[2.35rem] w-full flex-col items-center justify-center text-[10px] font-semibold leading-tight text-slate-200 group-hover:text-sky-200 sm:min-h-[2.5rem] sm:text-[11px]">
                {mobileTitleLines ? (
                  mobileTitleLines.map((line) => <span key={line}>{line}</span>)
                ) : (
                  <span className="leading-snug">{title}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          className="mt-6 flex w-full items-center justify-center rounded-xl border border-slate-600/45 bg-slate-900/30 py-3.5 text-sm font-medium text-slate-200 shadow-sm shadow-slate-950/20 transition hover:border-sky-500/30 hover:bg-slate-800/70 hover:text-sky-100"
        >
          {viewAllLabel}
        </Link>
      ) : null}
    </nav>
  );
}
