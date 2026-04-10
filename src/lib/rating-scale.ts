/** Markdown 等で `ratingBest` を省略したときの満点 */
export const RATING_BEST_DEFAULT = 10;

/**
 * 絞り込み用にスコアを 1〜10 の整数段階へ（満点基準で換算し四捨五入）
 */
export function ratingFilterBucket(value: number, best: number): number {
  if (!(best > 0)) {
    return Math.min(10, Math.max(1, Math.round(value)));
  }
  const scaled = Math.round((value / best) * 10);
  return Math.min(10, Math.max(1, scaled));
}

/** 一覧の★段階（1〜10）で ★9 以上（★9・★10）か。トップのピックアップ条件に使用 */
export function isStarBucketNineOrAbove(value: number, best: number): boolean {
  return ratingFilterBucket(value, best) >= 9;
}
