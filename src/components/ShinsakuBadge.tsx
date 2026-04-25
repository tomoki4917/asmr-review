type Props = {
  className?: string;
  /** 一覧カード左上オーバーレイ用 */
  variant?: "inline" | "overlay";
};

/** 発売から1週間以内（DLsite `regist_date` 基準）。`ReviewNewBadge` と並べてもレイアウトが崩れないよう別系配色 */
export function ShinsakuBadge({
  className = "",
  variant = "inline",
}: Props) {
  const size =
    variant === "overlay"
      ? "px-2.5 py-1 text-[11px] font-extrabold tracking-wide"
      : "px-2 py-0.5 text-[10px] font-extrabold tracking-wide";

  return (
    <span
      role="status"
      aria-label="発売から1週間以内の作品"
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 font-bold text-white shadow-md shadow-teal-950/40 ring-1 ring-white/25 ${size} ${className}`}
    >
      新作
    </span>
  );
}
