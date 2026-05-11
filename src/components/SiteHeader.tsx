import Link from "next/link";
import { DEFAULT_WORK_IMPRESSION_AVATAR_SRC } from "@/lib/default-work-impression-avatar";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-[3.75rem] max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:min-h-[4.25rem] sm:px-6 sm:py-2.5">
        <Link
          href="/"
          className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg py-2 pr-2 text-left transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/50 sm:gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 作品感想アイコンと同一の同梱アセット */}
          <img
            src={DEFAULT_WORK_IMPRESSION_AVATAR_SRC}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full border-2 border-slate-500/55 bg-slate-800/80 object-cover shadow-[0_1px_8px_rgba(0,0,0,0.4)] sm:h-[2.5rem] sm:w-[2.5rem]"
            width={40}
            height={40}
            loading="eager"
            decoding="async"
          />
          <span className="min-w-0">
            <span className="block text-xs font-medium uppercase tracking-[0.22em] text-sky-400/90">
              personal blog
            </span>
            <span className="block truncate text-base font-bold tracking-tight text-slate-50 sm:text-lg">
              催眠音声解析室
            </span>
          </span>
        </Link>
        <nav
          className="flex shrink-0 items-center gap-2.5 sm:gap-3.5"
          aria-label="主要ナビゲーション"
        >
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-500/65 bg-slate-800/65 px-4 py-2 text-sm font-medium leading-none text-slate-100 shadow-sm ring-1 ring-white/5 transition hover:border-sky-500/45 hover:bg-slate-700/75 sm:min-h-[3.25rem] sm:px-5 sm:py-2.5 sm:text-[0.9375rem]"
          >
            一覧
          </Link>
          <Link
            href="/contact/"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-500/65 bg-slate-800/65 px-4 py-2 text-sm font-medium leading-none text-slate-100 shadow-sm ring-1 ring-white/5 transition hover:border-sky-500/45 hover:bg-slate-700/75 sm:min-h-[3.25rem] sm:px-5 sm:py-2.5 sm:text-[0.9375rem]"
          >
            お問い合わせ
          </Link>
        </nav>
      </div>
    </header>
  );
}
