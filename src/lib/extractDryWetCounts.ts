/** 全角数字を半角に（クイック絶頂行の抽出用） */
function normalizeZenkakuDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * レビュー本文の `## 総合評価` 絶頂行から、クイック表示用のドライ／ウェット表記を抽出する。
 * 整数回と「複数回」の両方に対応（ドライ・ウェットとも）。
 */
export function extractDryWetCounts(markdown?: string): string | undefined {
  if (!markdown) return undefined;
  const normalized = normalizeZenkakuDigits(markdown.replace(/\r\n/g, "\n"));
  const dryPlural =
    /ドライシーン\s*複数回/.test(normalized) || /ドライ\s*複数回/.test(normalized);
  const wetPlural =
    /ウェットシーン\s*複数回/.test(normalized) || /ウェット\s*複数回/.test(normalized);
  const dryMatch =
    normalized.match(/ドライシーン\s*([0-9]+)\s*回/) ??
    normalized.match(/ドライ\s*([0-9]+)\s*回/);
  const wetMatch =
    normalized.match(/ウェットシーン\s*([0-9]+)\s*回/) ??
    normalized.match(/ウェット\s*([0-9]+)\s*回/);

  const dry = dryMatch?.[1];
  const wet = wetMatch?.[1];
  if (!dry && !wet && !dryPlural && !wetPlural) return undefined;

  const dryLabel = dry
    ? `ドライシーン${dry}回`
    : dryPlural
      ? "ドライシーン複数回"
      : undefined;
  const wetLabel = wet
    ? `ウェットシーン${wet}回`
    : wetPlural
      ? "ウェットシーン複数回"
      : undefined;

  if (dryLabel && wetLabel) return `${dryLabel} / ${wetLabel}`;
  if (dryLabel) return dryLabel;
  return wetLabel;
}
