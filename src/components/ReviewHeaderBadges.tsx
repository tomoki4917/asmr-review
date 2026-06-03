import type { DlsiteRankingBadgeEntry } from "@/lib/dlsite-ranking-catalog";
import { DlsiteRankingBadges } from "./DlsiteRankingBadge";
import { ReviewNewBadge } from "./ReviewNewBadge";
import { ShinsakuBadge } from "./ShinsakuBadge";

type Props = {
  showNew?: boolean;
  showShinsaku?: boolean;
  rankingEntries?: DlsiteRankingBadgeEntry[];
};

/** レビュー詳細：タイトル直上のバッジ行（タイトル幅を奪わない） */
export function ReviewHeaderBadges({
  showNew = false,
  showShinsaku = false,
  rankingEntries = [],
}: Props) {
  if (!showNew && !showShinsaku && rankingEntries.length === 0) {
    return null;
  }

  return (
    <div
      className="flex w-full flex-wrap items-center gap-2"
      aria-label="作品ステータス"
    >
      {showNew ? <ReviewNewBadge /> : null}
      {showShinsaku ? <ShinsakuBadge variant="inline" /> : null}
      {rankingEntries.length > 0 ? (
        <DlsiteRankingBadges variant="header" entries={rankingEntries} />
      ) : null}
    </div>
  );
}
