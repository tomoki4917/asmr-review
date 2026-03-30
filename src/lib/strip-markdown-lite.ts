/**
 * OGP / JSON-LD などプレーンテキストが必要な場所用の簡易ストリップ（完全な Markdown パーサではない）。
 */
export function stripMarkdownForMeta(md: string): string {
  let s = md.trim();
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  s = s.replace(/`{1,3}[^`]*`{1,3}/g, " ");
  s = s.replace(/[*_~>#]|^\s*[-*+]\s+/gm, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.length > 600 ? `${s.slice(0, 597)}…` : s;
}
