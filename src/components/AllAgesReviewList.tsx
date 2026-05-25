import { ReviewCard } from "@/components/ReviewCard";
import {
  isReviewVisibleByGoLiveAt,
  isReviewVisibleOnSite,
} from "@/lib/reviews";
import type { Review } from "@/lib/types";

export function AllAgesReviewList({ reviews }: { reviews: Review[] }) {
  const now = new Date();
  const items = reviews.filter((r) => r.contentKind === "review");

  if (items.length === 0) {
    return (
      <p className="mx-auto mt-10 max-w-xl text-center text-sm leading-relaxed text-slate-400">
        掲載予定のレビューはまだありません。
      </p>
    );
  }

  const preparingCount = items.filter(
    (r) => !isReviewVisibleByGoLiveAt(r, now)
  ).length;

  return (
    <>
      {preparingCount > 0 ? (
        <p className="mx-auto mt-8 max-w-3xl px-4 text-center text-xs leading-relaxed text-slate-500 sm:px-0">
          「準備中」は公開予定のレビューです。記事ページは公開日になりましたらお読みいただけます。
        </p>
      ) : null}
      <ul className="mx-auto mt-10 max-w-3xl space-y-6 px-4 sm:px-0">
        {items.map((r, index) => {
          const preparing = !isReviewVisibleByGoLiveAt(r, now);
          const linkable = isReviewVisibleOnSite(r, now);

          return (
            <li key={r.slug}>
              <ReviewCard
                review={r}
                priorityImage={index === 0}
                preparing={preparing}
                linkable={linkable}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
