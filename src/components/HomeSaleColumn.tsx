"use client";

import Link from "next/link";
import { useState } from "react";
import { ReviewCover } from "@/components/ReviewCover";
import {
  buildReviewListHref,
  HOME_REVIEW_LIST_BASE,
} from "@/lib/review-list-href";
import {
  getDlsiteProductById,
  resolveDlsiteSaleDisplay,
} from "@/lib/dlsite-product-catalog";
import { reviewTitleSingleLine } from "@/lib/review-title";
import type { Review } from "@/lib/types";

type Props = {
  reviews: Review[];
  previewMax: number;
};

export function HomeSaleColumn({ reviews, previewMax }: Props) {
  const [showAll, setShowAll] = useState(false);
  const total = reviews.length;

  if (total === 0) {
    return (
      <p className="mt-5 text-sm text-slate-500">
        現在、セール中の掲載はありません。
      </p>
    );
  }

  const visible = showAll ? reviews : reviews.slice(0, previewMax);
  const showToggle = total > previewMax;

  const tabOn =
    "rounded-full border border-fuchsia-400/55 bg-[#ca2aa6]/90 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-fuchsia-950/30";
  const tabOff =
    "rounded-full border border-violet-400/40 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-violet-200 transition hover:border-fuchsia-400/50 hover:bg-slate-800/90";

  return (
    <>
      {showToggle ? (
        <div
          className="mt-4 flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="セール中の表示件数"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!showAll}
            className={!showAll ? tabOn : tabOff}
            onClick={() => setShowAll(false)}
          >
            先頭{previewMax}件
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showAll}
            className={showAll ? tabOn : tabOff}
            onClick={() => setShowAll(true)}
          >
            全て（{total}）
          </button>
        </div>
      ) : null}
      <ul className="mt-5 space-y-5">
        {visible.map((r) => {
          const p = r.dlsiteProductId
            ? getDlsiteProductById(r.dlsiteProductId)
            : undefined;
          const sale = p ? resolveDlsiteSaleDisplay(p) : null;
          const label = r.itemName?.trim() || reviewTitleSingleLine(r.title);
          return (
            <li key={r.slug}>
              <Link href={`/reviews/${r.slug}/`} className="group flex gap-3">
                <div className="w-[4.5rem] shrink-0 sm:w-20">
                  <ReviewCover
                    coverImage={r.coverImage}
                    alt={label}
                    slug={r.slug}
                    className="rounded-md"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-pretty text-sm font-semibold leading-snug text-sky-300 group-hover:underline">
                    {label}
                  </p>
                  {sale?.on_sale ? (
                    <p className="mt-1.5 text-xs tabular-nums leading-relaxed">
                      <span className="font-bold text-slate-100">
                        ¥{sale.current_price.toLocaleString("ja-JP")}
                      </span>
                      <span className="ml-2 text-slate-500 line-through">
                        ¥{sale.original_price.toLocaleString("ja-JP")}
                      </span>
                      <span className="ml-2 text-rose-400">
                        {sale.discount_rate}%OFF
                      </span>
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-center">
        <Link
          href={buildReviewListHref(HOME_REVIEW_LIST_BASE, { sale: true })}
          className="text-sm font-medium text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
        >
          セール中一覧へ（絞り込み付き）
        </Link>
      </p>
    </>
  );
}
