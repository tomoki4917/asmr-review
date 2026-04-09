/**
 * 本文の `## 総合評価` で分割する（見出し横に「作品ページはこちら」を並べる用）。
 * 見出し直後の本文（星など）だけ `after` に含める。
 */
export function splitBodyAtFinalRating(
  body: string
): { before: string; after: string } | null {
  const mid = /\r?\n## 総合評価\s*\r?\n/;
  const m = mid.exec(body);
  if (m) {
    const before = body.slice(0, m.index).trimEnd();
    const after = body.slice(m.index + m[0].length).trimStart();
    if (!after) return null;
    return { before, after };
  }
  const start = /^## 総合評価\s*\r?\n/;
  const m2 = start.exec(body);
  if (!m2) return null;
  const after = body.slice(m2[0].length).trimStart();
  if (!after) return null;
  return { before: "", after };
}
