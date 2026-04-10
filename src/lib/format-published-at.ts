/** 一覧カード用。`YYYY-MM-DD` を `2026/4/9` 形式に */
export function formatPublishedAtForList(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso.trim();
  return `${Number(m[1])}/${Number(m[2])}/${Number(m[3])}`;
}
