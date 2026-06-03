import rankingsSnapshot from "../../data/dlsite-rankings.json";
import {
  DLSITE_RANKING_PERIOD_OPTIONS,
  type DlsiteBlogpartsSite,
  type DlsiteRankingPeriod,
} from "@/lib/dlsite-blogparts";

export type DlsiteRankingEntry = {
  rank: number;
  product_id: string;
};

export type DlsiteRankingsSnapshot = {
  site: DlsiteBlogpartsSite;
  fetched_at: string;
  periods: Partial<
    Record<DlsiteRankingPeriod, { entries: DlsiteRankingEntry[] }>
  >;
};

/** カード・詳細に出す期間（週間 / 月間） */
export const DLSITE_RANKING_BADGE_PERIODS = [
  "week",
  "month",
] as const satisfies readonly DlsiteRankingPeriod[];

export type DlsiteRankingBadgePeriod =
  (typeof DLSITE_RANKING_BADGE_PERIODS)[number];

const BADGE_SHORT_LABEL: Record<DlsiteRankingBadgePeriod, string> = {
  week: "週間ランキング",
  month: "月間ランキング",
};

export type DlsiteRankingBadgeEntry = {
  period: DlsiteRankingBadgePeriod;
  rank: number;
  periodLabel: string;
  shortLabel: string;
};

const snapshot = rankingsSnapshot as DlsiteRankingsSnapshot;

const rankMaps = new Map<DlsiteRankingBadgePeriod, Map<string, number>>();

for (const period of DLSITE_RANKING_BADGE_PERIODS) {
  const map = new Map<string, number>();
  for (const entry of snapshot.periods[period]?.entries ?? []) {
    const id = entry.product_id.trim().toUpperCase();
    if (!id) continue;
    const prev = map.get(id);
    if (prev == null || entry.rank < prev) {
      map.set(id, entry.rank);
    }
  }
  rankMaps.set(period, map);
}

function periodLabel(period: DlsiteRankingBadgePeriod): string {
  return (
    DLSITE_RANKING_PERIOD_OPTIONS.find((o) => o.value === period)?.label ??
    "ランキング"
  );
}

export function getDlsiteRankingsFetchedAt(): string | undefined {
  const raw = snapshot.fetched_at?.trim();
  return raw || undefined;
}

/** 該当する期間だけ返す（表示順: 週間 → 月間・各1件） */
export function getDlsiteRankingBadgesForProduct(
  productId: string | undefined | null
): DlsiteRankingBadgeEntry[] {
  const id = productId?.trim().toUpperCase();
  if (!id) return [];

  const out: DlsiteRankingBadgeEntry[] = [];
  const seen = new Set<DlsiteRankingBadgePeriod>();

  for (const period of DLSITE_RANKING_BADGE_PERIODS) {
    if (seen.has(period)) continue;
    const rank = rankMaps.get(period)?.get(id);
    if (rank == null) continue;
    seen.add(period);
    out.push({
      period,
      rank,
      periodLabel: periodLabel(period),
      shortLabel: BADGE_SHORT_LABEL[period],
    });
  }
  return out;
}

/** @deprecated 複数期間は `getDlsiteRankingBadgesForProduct` を使用 */
export function getDlsiteRankingForProduct(
  productId: string | undefined | null,
  period: DlsiteRankingPeriod = "week"
): { rank: number; periodLabel: string } | undefined {
  const badges = getDlsiteRankingBadgesForProduct(productId);
  const hit = badges.find((b) => b.period === period);
  if (!hit) return undefined;
  return { rank: hit.rank, periodLabel: hit.periodLabel };
}
