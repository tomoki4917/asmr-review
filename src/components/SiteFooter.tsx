import Link from "next/link";
import { SiteFooterCopyright } from "@/components/SiteFooterCopyright";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-700/40 bg-slate-900/85 py-10 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <nav
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-sky-300/90"
          aria-label="フッターリンク"
        >
          <Link href="/contact/" className="hover:text-sky-200 hover:underline">
            お問い合わせ
          </Link>
          <Link href="/privacy/" className="hover:text-sky-200 hover:underline">
            プライバシーポリシー
          </Link>
          <Link href="/disclaimer/" className="hover:text-sky-200 hover:underline">
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
