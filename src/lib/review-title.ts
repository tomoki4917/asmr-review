/**
 * フロントマターの `title: |` などで入れた改行を 1 行にしたタイトル。
 * メタデータ・一覧カード・画像 alt 用。
 */
export function reviewTitleSingleLine(title: string): string {
  return title
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}
