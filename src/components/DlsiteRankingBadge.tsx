import type { DlsiteRankingBadgeEntry } from "@/lib/dlsite-ranking-catalog";

type SingleProps = {
  rank: number;
  shortLabel: string;
  periodLabel: string;
  className?: string;
  variant?: "overlay" | "header";
};

type StackProps = {
  entries: DlsiteRankingBadgeEntry[];
  className?: string;
  variant?: "overlay" | "header";
};

/** 1期間＝1枚（上：期間名 / 下：順位） */
export function DlsiteRankingBadge({
  rank,
  shortLabel,
  periodLabel,
  className = "",
  variant = "header",
}: SingleProps) {
  const padding =
    variant === "overlay"
      ? "px-2 py-1"
      : "px-2.5 py-1.5 sm:px-3 sm:py-2";

  return (
    <span
      role="status"
      aria-label={`${periodLabel} ${rank}位`}
      title={`${periodLabel} ${rank}位`}
      className={`inline-flex shrink-0 flex-col items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 text-center font-bold text-white shadow-md shadow-orange-950/45 ring-1 ring-white/25 ${padding} ${className}`}
    >
      <span className="max-w-[5.5rem] text-[9px] font-bold leading-tight tracking-tight sm:max-w-none sm:text-[10px]">
        {shortLabel}
      </span>
      <span className="mt-0.5 text-sm font-extrabold leading-none tabular-nums sm:text-base">
        {rank}位
      </span>
    </span>
  );
}

/** 週間 / 月間 — 期間ごとに1枚 */
export function DlsiteRankingBadges({
  entries,
  className = "",
  variant = "header",
}: StackProps) {
  if (entries.length === 0) return null;

  const layout =
    variant === "overlay"
      ? "flex flex-col items-end gap-1.5"
      : "flex flex-wrap items-center gap-2";

  return (
    <div className={`${layout} ${className}`.trim()}>
      {entries.map((e) => (
        <DlsiteRankingBadge
          key={e.period}
          variant={variant}
          rank={e.rank}
          shortLabel={e.shortLabel}
          periodLabel={e.periodLabel}
        />
      ))}
    </div>
  );
}
