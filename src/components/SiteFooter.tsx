export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-700/40 bg-slate-900/85 py-10 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <p className="text-sm leading-relaxed text-slate-400">
          このサイトは個人によるレビューのみです。読者からの投稿・コメント機能はありません。
        </p>
        <p className="mt-3 text-xs text-slate-500">
          © {new Date().getFullYear()} ASMR音声紹介ラボ
        </p>
      </div>
    </footer>
  );
}
