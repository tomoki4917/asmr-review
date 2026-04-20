import Link from "next/link";
import { DEFAULT_WORK_IMPRESSION_AVATAR_SRC } from "@/lib/default-work-impression-avatar";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
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
              催眠音声レビュー室
            </span>
          </span>
        </Link>
        <nav
          className="flex shrink-0 items-center gap-2 sm:gap-3"
          aria-label="主要ナビゲーション"
        >
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-3 text-sm font-medium text-slate-100 shadow-sm transition hover:border-sky-500/40 hover:bg-slate-700/70 sm:px-4"
          >
            一覧
          </Link>
          <Link
            href="/contact/"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-600/70 bg-slate-800/60 px-3 text-sm font-medium text-slate-100 shadow-sm transition hover:border-sky-500/40 hover:bg-slate-700/70 sm:px-4"
          >
            お問い合わせ
          </Link>
        </nav>
      </div>
    </header>
  );
}
