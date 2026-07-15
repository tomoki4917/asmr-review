type Props = {
  className?: string;
  variant?: "inline" | "overlay";
};

/** 執筆者プレビュー専用：読者一覧・本番では非表示の下書き */
export function ReviewDraftBadge({
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
      aria-label="下書き（読者には非表示）"
      className={`inline-flex shrink-0 items-center justify-center rounded-md border border-amber-400/55 bg-amber-950/85 font-bold text-amber-100 shadow-md shadow-amber-950/35 ring-1 ring-amber-300/25 ${size} ${className}`}
    >
      下書き
    </span>
  );
}
