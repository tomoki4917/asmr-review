type Props = {
  className?: string;
  variant?: "inline" | "overlay";
};

/** 予約公開前のレビュー（全年齢一覧など） */
export function ReviewPreparingBadge({
  className = "",
  variant = "overlay",
}: Props) {
  const size =
    variant === "overlay"
      ? "px-2.5 py-1 text-[11px] tracking-wide"
      : "px-2 py-0.5 text-[10px] tracking-wide";

  return (
    <span
      role="status"
      aria-label="公開準備中のレビュー"
      className={`inline-flex shrink-0 items-center justify-center rounded-md border border-sky-400/50 bg-sky-950/85 font-bold text-sky-100 shadow-md shadow-sky-950/35 ring-1 ring-sky-300/25 ${size} ${className}`}
    >
      準備中
    </span>
  );
}
