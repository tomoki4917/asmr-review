import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { formatAxisScore, HYPNOSIS_V1_AXES } from "./format-axis-score.mjs";

/**
 * _分析データ.json の scores と index.md のグラフ評価内訳・PNG 更新時刻を突合。
 */
export async function auditGraphScores(slug, text, reviewsDir) {
  const errors = [];
  if (!text.includes("**グラフ評価内訳**")) {
    return { ok: true, errors };
  }

  const jsonPath = path.join(reviewsDir, slug, "_分析データ.json");
  let data;
  try {
    data = JSON.parse(await readFile(jsonPath, "utf8"));
  } catch {
    return { ok: true, errors };
  }

  if (data.schemaVersion !== 1 || !data.scores) {
    return { ok: true, errors };
  }

  for (const [label, key] of HYPNOSIS_V1_AXES) {
    const raw = data.scores[key];
    if (raw == null) continue;
    const expected = formatAxisScore(raw);
    const re = new RegExp(`- \\*\\*${label} ([\\d.]+)\\*\\*`);
    const m = text.match(re);
    if (!m) {
      errors.push(`グラフ評価内訳: ${label} 行なし`);
    } else if (m[1] !== expected) {
      errors.push(
        `グラフ評価内訳の${label}: 本文 ${m[1]} ≠ _分析データ.json ${expected}`
      );
    }
  }

  const trianglePath = path.join(reviewsDir, slug, "review_triangle.png");
  try {
    const [jsonSt, pngSt] = await Promise.all([
      stat(jsonPath),
      stat(trianglePath),
    ]);
    if (jsonSt.mtimeMs > pngSt.mtimeMs + 2000) {
      errors.push(
        "review_triangle.png が _分析データ.json より古い → py -3 scripts/generate_review_triangle.py " +
          slug
      );
    }
  } catch {
    errors.push(
      "review_triangle.png なし → py -3 scripts/generate_review_triangle.py " + slug
    );
  }

  return { ok: errors.length === 0, errors };
}
