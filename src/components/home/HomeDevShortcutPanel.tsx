import Link from "next/link";

/**
 * 開発環境のみ。トップの琥珀枠内に置くショートカット（SNS ランディング＋次サイト草案）。
 */
export function HomeDevShortcutPanel() {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <aside
      className="mx-auto mt-8 max-w-xl rounded-xl border border-amber-600/55 bg-amber-950/35 px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:mt-10"
      aria-label="開発用のショートカット"
    >
      <p className="text-sm font-semibold text-amber-200">
        開発環境のみ：SNS 流入ページの確認
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-100/80 sm:text-sm">
        本番ビルドでは表示されません。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/welcome/tiktok/"
          className="inline-flex min-h-9 items-center rounded-full border border-amber-500/45 bg-amber-900/45 px-3 text-sm font-medium text-amber-50 transition hover:border-amber-400/65 hover:bg-amber-800/55"
        >
          /welcome/tiktok/
        </Link>
        <Link
          href="/welcome/youtube/"
          className="inline-flex min-h-9 items-center rounded-full border border-amber-500/45 bg-amber-900/45 px-3 text-sm font-medium text-amber-50 transition hover:border-amber-400/65 hover:bg-amber-800/55"
        >
          /welcome/youtube/
        </Link>
        <Link
          href="/dev/site-next/"
          className="inline-flex min-h-9 items-center rounded-full border border-amber-500/45 bg-amber-900/45 px-3 text-sm font-medium text-amber-50 transition hover:border-amber-400/65 hover:bg-amber-800/55"
        >
          /dev/site-next/
        </Link>
      </div>
      <p className="mt-2 text-[0.7rem] leading-relaxed text-amber-100/65 sm:text-xs">
        次サイトの芽は「/dev/site-next/」。ここからレイアウトを足していけます。
      </p>
    </aside>
  );
}
