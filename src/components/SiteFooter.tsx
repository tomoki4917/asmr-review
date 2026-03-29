export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200/80 bg-white/60 py-10 dark:border-stone-800/80 dark:bg-stone-950/60">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          このサイトは個人によるレビューのみです。読者からの投稿・コメント機能はありません。
        </p>
        <p className="mt-3 text-xs text-stone-500 dark:text-stone-500">
          © {new Date().getFullYear()} 催眠音声紹介部屋
        </p>
      </div>
    </footer>
  );
}
