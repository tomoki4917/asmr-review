import {
  getDlsiteProductById,
  shouldShowDlsitePriceOnReviewListCard,
} from "@/lib/dlsite-product-catalog";
import type { Review } from "@/lib/types";

function reviewListPriceEnabled(): boolean {
  return (
    typeof process.env.NEXT_PUBLIC_SHOW_DL_PRODUCT_PRICES !== "string" ||
    process.env.NEXT_PUBLIC_SHOW_DL_PRODUCT_PRICES !== "false"
  );
}

/**
 * レビュー一覧カード・ピックアップなどで、DLsite 税込価格を星評価横に出す。
 */
export function ReviewDlsiteListPrice({ review }: { review: Review }) {
  if (!reviewListPriceEnabled()) return null;
  if (!shouldShowDlsitePriceOnReviewListCard(review.dlsiteProductId)) {
    return null;
  }
  const p = getDlsiteProductById(review.dlsiteProductId!);
  if (!p || p.current_price <= 0) return null;

  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0 text-base tabular-nums">
      {p.on_sale ? (
        <>
          <span className="shrink-0 rounded bg-rose-600/85 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
            {p.discount_rate}%OFF
          </span>
          <span className="text-lg font-bold tracking-tight text-amber-100">
            ¥{p.current_price.toLocaleString("ja-JP")}
          </span>
          <span className="text-sm font-normal text-slate-500 line-through">
            ¥{p.original_price.toLocaleString("ja-JP")}
          </span>
        </>
      ) : (
        <span className="text-lg font-bold tracking-tight text-slate-100">
          ¥{p.current_price.toLocaleString("ja-JP")}
        </span>
      )}
      <span className="sr-only">（税込）</span>
    </span>
  );
}
