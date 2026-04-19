type Props = {
  className?: string;
  /** カード左上オーバーレイ用（少し大きめ） */
  variant?: "inline" | "overlay";
};

/** 新着レビュー用。一覧・詳細・ピックアップで共通利用 */
export function ReviewNewBadge({
  className = "",
  variant = "inline",
}: Props) {
  const size =
    variant === "overlay"
      ? "px-2.5 py-1 text-[11px] uppercase tracking-[0.14em]"
      : "px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]";

  return (
    <span
      role="status"
      aria-label="新着のレビュー"
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 font-extrabold text-white shadow-md shadow-rose-950/40 ring-1 ring-white/30 ${size} ${className}`}
    >
      New
    </span>
  );
}
