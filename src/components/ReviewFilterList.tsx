"use client";

import { useMemo, useState } from "react";
import { isReviewNewPublication } from "@/lib/review-new-badge";
import type { Review } from "@/lib/types";
import { ReviewCard } from "./ReviewCard";

type Props = {
  reviews: Review[];
};

function matchesTags(review: Review, selected: Set<string>): boolean {
  if (selected.size === 0) return true;
  for (const t of selected) {
    if (!review.tags.includes(t)) return false;
  }
  return true;
}

function collectTags(reviews: Review[]): string[] {
  const s = new Set<string>();
  for (const r of reviews) {
    for (const t of r.tags) s.add(t);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b, "ja"));
}

export function ReviewFilterList({ reviews }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allTags = useMemo(() => collectTags(reviews), [reviews]);

  const filtered = useMemo(
    () => reviews.filter((r) => matchesTags(r, selected)),
    [reviews, selected]
  );

  function toggleTag(tag: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function clearFilters() {
    setSelected(new Set());
  }

  return (
    <div>
      {allTags.length > 0 && (
        <div className="mb-8 rounded-2xl border border-stone-200/90 bg-white/90 p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900/80 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            タグで絞り込み
          </p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            複数選ぶと、選んだタグを
            <span className="font-semibold text-stone-800 dark:text-stone-200">
              すべて含む
            </span>
            記事だけが表示されます。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const on = selected.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={[
                    "min-h-11 rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98]",
                    on
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20 dark:bg-indigo-500 dark:shadow-indigo-950/40"
                      : "border border-stone-200 bg-stone-50 text-stone-800 hover:border-indigo-200 hover:bg-white dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:hover:border-indigo-500/40",
                  ].join(" ")}
                >
                  {tag}
                </button>
              );
            })}
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-11 rounded-xl border border-dashed border-stone-400 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:border-stone-500 hover:bg-stone-50 dark:border-stone-500 dark:text-stone-400 dark:hover:bg-stone-900"
            >
              すべて表示
            </button>
          </div>
        </div>
      )}

      <p className="mb-5 text-sm font-medium text-stone-500 dark:text-stone-400">
        {filtered.length} 件を表示
      </p>

      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-10">
        {filtered.map((review, index) => (
          <li key={review.slug}>
            <ReviewCard
              review={review}
              priorityImage={index < 2}
              showNew={isReviewNewPublication(review, new Date())}
            />
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="rounded-3xl border border-stone-200 bg-white/90 p-10 text-center text-sm leading-relaxed text-stone-600 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-400">
          条件に合う記事がありません。タグを減らすか「すべて表示」を押してください。
        </p>
      )}
    </div>
  );
}
