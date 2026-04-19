import type { Review } from "@/lib/types";

/** 「DLsite で見る」用。表紙リンク → DLsite 系 affiliateLinks の順で採用 */
export function resolveDlsiteAffiliateHref(review: Review): string | undefined {
  const cover = review.coverAffiliateHref?.trim();
  if (
    cover &&
    (cover.includes("dlaf.jp") ||
      cover.includes("dlsite.com") ||
      cover.includes("dlsite.jp"))
  ) {
    return cover;
  }
  const dlsite = review.affiliateLinks.find((l) => l.vendor === "dlsite");
  return dlsite?.href?.trim();
}
