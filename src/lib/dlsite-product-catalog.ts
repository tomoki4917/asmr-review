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

/** レビュー一覧カードに税込価格を併記する作品（`dlsiteProductId`）。拡張時に追加 */
export const DL_PRODUCT_IDS_ON_REVIEW_LIST_CARD = new Set<string>([
  "RJ01517030",
  "RJ01541752",
  "RJ01546680",
  "RJ01523980",
  "RJ01594429",
  "RJ213951",
  "RJ215569",
  "RJ259751",
  "RJ312554",
  "RJ380162",
]);

export function shouldShowDlsitePriceOnReviewListCard(
  dlsiteProductId: string | undefined
): boolean {
  return Boolean(
    dlsiteProductId && DL_PRODUCT_IDS_ON_REVIEW_LIST_CARD.has(dlsiteProductId)
  );
}
