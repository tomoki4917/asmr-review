/**
 * generate_review_triangle.py の format_axis_score と同一。
 * レーダー画像・グラフ評価内訳・監査で同じ表記に揃える。
 */
export function formatAxisScore(val) {
  const v = Number(val);
  if (!Number.isFinite(v)) return String(val);
  let text = v.toFixed(2).replace(/0+$/g, "").replace(/\.$/, "");
  if (!text.includes(".")) text = v.toFixed(1);
  return text;
}

/** schemaVersion 1（催眠三軸）の軸ラベルと scores キー */
export const HYPNOSIS_V1_AXES = [
  ["トランス度", "trance"],
  ["快楽度", "pleasure"],
  ["満足度", "satisfaction"],
];
