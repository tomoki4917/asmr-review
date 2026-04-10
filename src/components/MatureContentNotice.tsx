/**
 * 成人向けコンテンツの閲覧注意。
 * 露骨な表現は避け、閲覧制限と趣旨のみを中立に記載する。
 */
export function MatureContentNotice({
  context,
  className = "",
}: {
  context: "home" | "review";
  className?: string;
}) {
  const body =
    context === "home"
      ? "当サイトでは同人音声作品のレビュー等を掲載しており、成人向けの表現や話題を含む場合があります。18歳未満の方のご利用はお控えください。"
      : "本ページのレビューは対象作品の性質上、成人向けの表現を含む場合があります。18歳未満の方の閲覧はお控えください。";

  return (
    <aside
      role="note"
      className={`rounded-xl border border-amber-900/40 bg-amber-950/25 px-4 py-3 text-xs leading-relaxed text-slate-400 sm:text-sm ${className}`}
    >
      <p className="font-medium text-amber-200/90">閲覧の注意（成人向け）</p>
      <p className="mt-1.5">{body}</p>
    </aside>
  );
}
