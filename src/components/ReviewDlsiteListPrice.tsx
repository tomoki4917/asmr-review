import {
  getDlsiteProductById,
  resolveDlsiteSaleDisplay,
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
export function ReviewDlsiteListPrice({
  review,
  size = "default",
}: {
  review: Review;
  size?: "default" | "compact";
}) {
  if (!reviewListPriceEnabled()) return null;
  if (!shouldShowDlsitePriceOnReviewListCard(review.dlsiteProductId)) {
    return null;
  }
  const p = getDlsiteProductById(review.dlsiteProductId!);
  if (!p) return null;
  const sale = resolveDlsiteSaleDisplay(p);

  const compact = size === "compact";

  return (
    <span
      className={[
        "inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0 tabular-nums",
        compact ? "text-sm" : "text-base",
      ].join(" ")}
    >
      {sale.on_sale ? (
        <>
          <span
            className={[
              "shrink-0 rounded bg-rose-600/85 font-bold leading-none text-white",
              compact
                ? "px-1 py-0.5 text-[10px]"
                : "px-1.5 py-0.5 text-[11px]",
            ].join(" ")}
          >
            {sale.discount_rate}%OFF
          </span>
          <span
            className={[
              "font-bold tracking-tight text-amber-100",
              compact ? "text-sm" : "text-lg",
            ].join(" ")}
          >
            ¥{sale.current_price.toLocaleString("ja-JP")}
          </span>
          <span
            className={[
              "font-normal text-slate-500 line-through",
              compact ? "text-xs" : "text-sm",
            ].join(" ")}
          >
            ¥{sale.original_price.toLocaleString("ja-JP")}
          </span>
        </>
      ) : (
        <>
          <span
            className={[
              "font-bold tracking-tight text-slate-100",
              compact ? "text-sm" : "text-lg",
            ].join(" ")}
          >
            ¥{sale.current_price.toLocaleString("ja-JP")}
          </span>
          {sale.current_price === 0 ? (
            <span
              className={[
                "font-medium text-emerald-200/90",
                compact ? "text-[10px]" : "text-xs",
              ].join(" ")}
            >
              （税込・無料）
            </span>
          ) : null}
        </>
      )}
      <span className="sr-only">（税込）</span>
    </span>
  );
}
