/** @param {string | undefined} markdown */
export function extractDryWetCounts(markdown) {
  if (!markdown) return undefined;
  const normalized = markdown
    .replace(/\r\n/g, "\n")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
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
