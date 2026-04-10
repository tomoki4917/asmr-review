/**
 * 本文の `## 総合評価` で分割する（見出し横にアフィリエイト用）。
 * 見出し直後から、次の `## `（h2）手前までを `rating`。それ以降を `rest`（作品像・パート解説など）。
 */

/**
 * `rating` 文字列内の `### 作品解説と感想` で二分割する。
 * 星・価格・注記までを `core`、ラベル見出し以降を `workIntro` とし、体験版ボタンを `core` と同列に置く（モバイルでもラベルの下にボタンが来ない）。
 */
export function splitRatingAtWorkIntroLabel(rating: string): {
  core: string;
  workIntro: string;
} {
  const n = rating.replace(/\r\n/g, "\n");
  const needle = "\n### 作品解説と感想";
  const i = n.indexOf(needle);
  if (i === -1) {
    if (n.startsWith("### 作品解説と感想")) {
      return { core: "", workIntro: n.trim() };
    }
    return { core: n.trim(), workIntro: "" };
  }
  return {
    core: n.slice(0, i).trimEnd(),
    workIntro: n.slice(i + 1).trimStart(),
  };
}

/** `rest` 内の `## 作品感想` または `### 作品感想` ブロック直後で分割（購入ボタン挿入用）。該当見出しが無ければ null。 */
export function splitRestAfterWorkImpression(rest: string): {
  before: string;
  after: string;
} | null {
  const n = rest.replace(/\r\n/g, "\n");
  const re = /\n#{2,3} 作品感想\s*\n/;
  const m = re.exec(n);
  if (!m) return null;
  const contentStart = m.index + m[0].length;
  const remainder = n.slice(contentStart);
  const nextH = /\n#{2,3}\s+/;
  const m2 = nextH.exec(remainder);
  const body = m2 ? remainder.slice(0, m2.index) : remainder;
  const endPos = contentStart + body.length;
  return {
    before: n.slice(0, endPos).trimEnd(),
    after: n.slice(endPos).trimStart(),
  };
}

export function splitBodyAtFinalRating(
  body: string
): { before: string; rating: string; rest: string } | null {
  const normalized = body.replace(/\r\n/g, "\n");

  function splitRatingAndRest(afterHeading: string): {
    rating: string;
    rest: string;
  } {
    const nextH2 = /\n## (?![#])/;
    const m = nextH2.exec(afterHeading);
    if (!m) {
      return { rating: afterHeading.trim(), rest: "" };
    }
    return {
      rating: afterHeading.slice(0, m.index).trim(),
      rest: afterHeading.slice(m.index).trimStart(),
    };
  }

  const atStart = /^## 総合評価\s*\n/;
  if (atStart.test(normalized)) {
    const after = normalized.replace(atStart, "");
    const { rating, rest } = splitRatingAndRest(after);
    if (!rating) return null;
    return { before: "", rating, rest };
  }

  const mid = /\n## 総合評価\s*\n/;
  const m = mid.exec(normalized);
  if (!m) return null;

  const before = normalized.slice(0, m.index).trimEnd();
  const after = normalized.slice(m.index + m[0].length);
  const { rating, rest } = splitRatingAndRest(after);
  if (!rating) return null;
  return { before, rating, rest };
}
