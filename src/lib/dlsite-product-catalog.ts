import catalog from "../../data/products.json";

export type DlsiteProductRecord = {
  id: string;
  url: string;
  current_price: number;
  original_price: number;
  discount_rate: number;
  on_sale: boolean;
  /** ページから拾えたセール期限の生テキスト（あれば） */
  sale_limit: string;
  /** ISO 8601。取得できた場合のみ */
  sale_end_iso: string;
  /** 最終スクレイプ時刻 */
  fetched_at: string;
};

const rows = catalog as DlsiteProductRecord[];

export function getDlsiteProductById(id: string): DlsiteProductRecord | undefined {
  return rows.find((p) => p.id === id);
}

/**
 * 一覧カードに税込・セール価格を出す条件。
 * `data/products.json` に該当 `id` があり、`current_price` が正のとき（ホワイトリストは使わない）。
 */
export function shouldShowDlsitePriceOnReviewListCard(
  dlsiteProductId: string | undefined
): boolean {
  if (!dlsiteProductId) return false;
  const p = getDlsiteProductById(dlsiteProductId);
  return Boolean(p && p.current_price > 0);
}
