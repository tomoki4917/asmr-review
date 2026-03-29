import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[var(--page-bg)]/90 backdrop-blur-md dark:border-stone-800/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="min-h-11 min-w-0 rounded-lg py-2 pr-2 text-left transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          <span className="block text-xs font-medium uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
            personal blog
          </span>
          <span className="block truncate text-base font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-lg">
            催眠音声紹介部屋
          </span>
        </Link>
        <nav className="shrink-0" aria-label="主要ナビゲーション">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-800 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-indigo-500/50 dark:hover:bg-stone-800"
          >
            一覧
          </Link>
        </nav>
      </div>
    </header>
  );
}
