import Link from "next/link";
import { SiteHeaderBrand } from "@/components/SiteHeaderBrand";
import { SiteRatingSwitch } from "@/components/SiteRatingSwitch";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex min-h-[3.75rem] max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:min-h-[4.25rem] sm:px-6 sm:py-2.5">
        <SiteHeaderBrand />
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
          <SiteRatingSwitch className="max-w-[min(100%,20rem)]" />
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
      </div>
    </header>
  );
}
