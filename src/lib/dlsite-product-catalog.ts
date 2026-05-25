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
  /**
   * 作品ページ `contents.detail[0].regist_date`（YYYY/MM/DD）から変換した UTC の ISO。
   * `npm run update-prices` で更新。未取得時は空。
   */
  release_date_iso?: string;
  /** 最終スクレイプ時刻 */
  fetched_at: string;
};

/** 発売日（regist_date）から7日以内を「新作」とする */
const SHINSAKU_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isDlsiteProductShinsaku(
  product: DlsiteProductRecord | undefined,
  now: Date
): boolean {
  const iso = product?.release_date_iso?.trim();
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  const elapsed = now.getTime() - t;
  return elapsed >= 0 && elapsed <= SHINSAKU_WINDOW_MS;
}

const rows = catalog as DlsiteProductRecord[];

export function getDlsiteProductById(id: string): DlsiteProductRecord | undefined {
  return rows.find((p) => p.id === id);
}

/** `npm run update-price:one` 等で DLsite から取り込み済みか（空の `fetched_at` は未取得プレースホルダー） */
export function isDlsitePriceFetched(
  product: DlsiteProductRecord | undefined
): boolean {
  const raw = product?.fetched_at?.trim();
  if (!raw) return false;
  return !Number.isNaN(Date.parse(raw));
}

/**
 * 一覧カードに税込・セール価格を出す条件。
 * 該当 `id` があり **`fetched_at` 済み**で `current_price` が数値（**0円＝無料は取得後のみ表示**）。
 */
/** 表示用セール状態（`on_sale` フラグが古くても定価＞現在価格ならセール扱い） */
export function resolveDlsiteSaleDisplay(product: DlsiteProductRecord): {
  on_sale: boolean;
  current_price: number;
  original_price: number;
  discount_rate: number;
} {
  const current = product.current_price;
  const original = Math.max(product.original_price, current);
  const on_sale =
    product.on_sale || (original > current && current > 0);
  const discount_rate =
    on_sale && original > 0
      ? Math.min(
          100,
          Math.max(
            0,
            product.discount_rate > 0
              ? product.discount_rate
              : Math.round((1 - current / original) * 100)
          )
        )
      : 0;
  return { on_sale, current_price: current, original_price: original, discount_rate };
}

export function shouldShowDlsitePriceOnReviewListCard(
  dlsiteProductId: string | undefined
): boolean {
  const id = dlsiteProductId?.trim();
  if (!id) return false;
  const p = getDlsiteProductById(id);
  if (!p || !isDlsitePriceFetched(p)) return false;
  const n = p.current_price;
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}
