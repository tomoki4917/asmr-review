import type { DlsiteProductRecord } from "@/lib/dlsite-product-catalog";

const ALERT_DAYS = 7;

function formatYen(n: number): string {
  return n.toLocaleString("ja-JP");
}

function daysUntil(iso: string): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const end = new Date(t);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export type DlsitePricePanelProps = {
  product: DlsiteProductRecord;
  /** アフィリエイト用 URL。未指定時は `product.url`（公式商品ページ） */
  affiliateHref?: string;
};

/**
 * DLsite の価格表示（data/products.json をソース）。
 * 無効化: 環境変数 `NEXT_PUBLIC_SHOW_DL_PRODUCT_PRICES=false`
 */
export function DlsitePricePanel({
  product,
  affiliateHref,
}: DlsitePricePanelProps) {
  const outboundHref =
    (affiliateHref && affiliateHref.trim()) || product.url;

  const show =
    typeof process.env.NEXT_PUBLIC_SHOW_DL_PRODUCT_PRICES === "string"
      ? process.env.NEXT_PUBLIC_SHOW_DL_PRODUCT_PRICES !== "false"
      : true;

  if (!show) return null;

  const hasPrice = product.current_price > 0;
  const urgentDays =
    product.sale_end_iso && product.on_sale
      ? daysUntil(product.sale_end_iso)
      : null;
  const showUrgent =
    urgentDays != null && urgentDays >= 0 && urgentDays <= ALERT_DAYS;

  return (
    <aside
      className="mt-5 rounded-2xl border border-amber-500/25 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-4 shadow-inner shadow-black/20 sm:p-5"
      aria-label="DLsite の価格情報"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-slate-200">
          DLsite 価格
        </h2>
        {product.fetched_at ? (
          <p className="text-[11px] text-slate-500">
            更新:{" "}
            <time dateTime={product.fetched_at}>
              {product.fetched_at.slice(0, 10)}
            </time>
          </p>
        ) : null}
      </div>

      {!hasPrice ? (
        <p className="mt-2 text-sm text-slate-500">
          価格データがありません。リポジトリで{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs">
            npm run update-prices
          </code>{" "}
          を実行してください。
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {product.on_sale ? (
              <>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-amber-300/90">
                    セール価格（税込）
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-amber-200">
                    {formatYen(product.current_price)}
                    <span className="ml-0.5 text-base font-semibold">円</span>
                  </p>
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="rounded-md bg-rose-600/90 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                    {product.discount_rate}%OFF
                  </span>
                  <p className="text-sm text-slate-500">
                    <span className="line-through">
                      {formatYen(product.original_price)}円
                    </span>
                    <span className="ml-2 text-slate-400">定価（税込）</span>
                  </p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-[11px] font-medium text-slate-400">
                  価格（税込）
                </p>
                <p className="text-2xl font-bold tabular-nums text-slate-100">
                  {formatYen(product.current_price)}
                  <span className="ml-0.5 text-base font-semibold">円</span>
                </p>
              </div>
            )}
          </div>

          {product.on_sale && product.sale_limit ? (
            <p className="mt-2 text-xs text-slate-400">{product.sale_limit}</p>
          ) : null}

          {showUrgent && urgentDays != null ? (
            <p
              className="mt-3 rounded-lg border border-amber-400/40 bg-amber-950/50 px-3 py-2 text-sm font-medium text-amber-100"
              role="status"
            >
              {urgentDays === 0
                ? "本日セール終了の可能性があります（ページでご確認ください）"
                : `あと${urgentDays}日でセール終了の見込みです`}
            </p>
          ) : null}
        </>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        購入前に必ず公式ページの価格をご確認ください。
      </p>

      <a
        href={outboundHref}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-sky-500/40 bg-sky-600/20 px-4 text-sm font-semibold text-sky-100 transition hover:bg-sky-600/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/60"
      >
        DLsite で見る
      </a>
    </aside>
  );
}
