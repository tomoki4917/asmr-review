import Link from "next/link";
import { SiteFooterCopyright } from "@/components/SiteFooterCopyright";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-700/40 bg-slate-900/85 py-10 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <nav
          className="flex flex-col items-stretch gap-2 text-base sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-4 sm:gap-y-2 sm:text-sm"
          aria-label="フッターリンク"
        >
          <Link
            href="/start/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-sky-300/90 transition hover:bg-slate-800/50 hover:text-sky-200 sm:min-h-0 sm:px-0 sm:py-0 sm:hover:bg-transparent sm:hover:underline"
          >
            はじめての方へ
          </Link>
          <Link
            href="/about/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-sky-300/90 transition hover:bg-slate-800/50 hover:text-sky-200 sm:min-h-0 sm:px-0 sm:py-0 sm:hover:bg-transparent sm:hover:underline"
          >
            サイトについて
          </Link>
          <Link
            href="/evaluation-method/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-sky-300/90 transition hover:bg-slate-800/50 hover:text-sky-200 sm:min-h-0 sm:px-0 sm:py-0 sm:hover:bg-transparent sm:hover:underline"
          >
            評価メソッド
          </Link>
          <Link
            href="/contact/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-sky-300/90 transition hover:bg-slate-800/50 hover:text-sky-200 sm:min-h-0 sm:px-0 sm:py-0 sm:hover:bg-transparent sm:hover:underline"
          >
            お問い合わせ
          </Link>
          <Link
            href="/privacy/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-sky-300/90 transition hover:bg-slate-800/50 hover:text-sky-200 sm:min-h-0 sm:px-0 sm:py-0 sm:hover:bg-transparent sm:hover:underline"
          >
            プライバシーポリシー
          </Link>
          <Link
            href="/disclaimer/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-sky-300/90 transition hover:bg-slate-800/50 hover:text-sky-200 sm:min-h-0 sm:px-0 sm:py-0 sm:hover:bg-transparent sm:hover:underline"
          >
            免責事項
          </Link>
        </nav>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-slate-400">
          このサイトは個人によるレビュー・解説です。
        </p>
        <SiteFooterCopyright />
      </div>
    </footer>
  );
}
