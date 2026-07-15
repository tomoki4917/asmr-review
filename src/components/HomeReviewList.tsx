"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  POSTED_REVIEWS_CHANGED_EVENT,
  POSTED_REVIEWS_STORAGE_KEY,
  effectivePostKind,
  isStarRatedReview,
  postedKindLabel,
  postedReviewRatingBest,
  readPostedReviewsFromStorage,
  type PostedReview,
} from "@/lib/posted-review";
import {
  formatPublishedAtForList,
  reviewPublicationTimeMs,
} from "@/lib/format-published-at";
import { reviewTitleSingleLine } from "@/lib/review-title";
import {
  getDlsiteProductById,
  isDlsitePriceFetched,
  resolveDlsiteSaleDisplay,
} from "@/lib/dlsite-product-catalog";
import { ratingFilterBucket } from "@/lib/rating-scale";
import { isReviewNewPublication } from "@/lib/review-new-badge";
import {
  REVIEWS_LIST_FILTERS_ID,
  REVIEWS_LIST_SECTION_ID,
} from "@/lib/review-list-href";
import {
  featuredSlugsForVoiceActor,
  sortReviewSlugsWithFeatured,
} from "@/lib/voice-actor-hub-picks";
import { reviewMatchesVoiceActorName } from "@/lib/review-voice-actors";
import {
  parseVoiceActorToneId,
  reviewMatchesVoiceActorTone,
  VOICE_ACTOR_TONE_LABELS,
} from "@/lib/voice-actor-tone";
import {
  ARTICLE_LIST_CATEGORY_LABELS,
  articleTagsMatchCategory,
  parseArticleListCategory,
  type ArticleListCategory,
} from "@/lib/article-list-category";
import {
  mergedReviewMatchesSearchQuery,
  normalizeReviewListSearchQuery,
} from "@/lib/review-list-search";
import {
  isOwnerDraftReview,
  isReviewVisibleByGoLiveAt,
  isReviewVisibleOnSite,
} from "@/lib/review-visibility";
import type { Review } from "@/lib/types";
import { FileMarkdownArticleCard } from "@/components/FileMarkdownArticleCard";
import { ReviewCard } from "@/components/ReviewCard";
import { ReviewCoverPlaceholder } from "@/components/ReviewCover";
import { StarRating } from "@/components/StarRating";

type MergedReviewItem =
  | { kind: "file"; review: Review }
  | { kind: "local"; review: PostedReview };

function publishedAtMs(item: MergedReviewItem): number {
  if (item.kind === "file") return reviewPublicationTimeMs(item.review);
  const t = Date.parse(item.review.publishedAt);
  return Number.isNaN(t) ? 0 : t;
}

function mergeItemKey(item: MergedReviewItem): string {
  return item.kind === "file" ? item.review.slug : item.review.id;
}

function sortMergedByPublishedAt(
  items: MergedReviewItem[],
  order: "new" | "old"
): MergedReviewItem[] {
  return [...items].sort((a, b) => {
    const ta = publishedAtMs(a);
    const tb = publishedAtMs(b);
    let cmp = tb - ta;
    if (order === "old") cmp = -cmp;
    if (cmp !== 0) return cmp;
    return mergeItemKey(a).localeCompare(mergeItemKey(b));
  });
}

function mergeReviews(
  markdownReviews: Review[],
  posted: PostedReview[]
): MergedReviewItem[] {
  const mdReviews = markdownReviews.filter((r) => r.contentKind === "review");
  const reviewPosted = posted.filter((p) => effectivePostKind(p) === "review");
  const items: MergedReviewItem[] = [
    ...mdReviews.map((review) => ({ kind: "file" as const, review })),
    ...reviewPosted.map((review) => ({ kind: "local" as const, review })),
  ];
  return sortMergedByPublishedAt(items, "new");
}

function mergedReviewRatingBest(item: MergedReviewItem): number {
  if (item.kind === "file") {
    return item.review.ratingBest ?? 10;
  }
  return postedReviewRatingBest(item.review);
}

function mergedFilterBucket(item: MergedReviewItem): number {
  const v =
    item.kind === "file" ? item.review.ratingValue : item.review.ratingValue;
  return ratingFilterBucket(v, mergedReviewRatingBest(item));
}

function matchesStarFilter(
  item: MergedReviewItem,
  filter: number | "lte5"
): boolean {
  const b = mergedFilterBucket(item);
  if (filter === "lte5") return b <= 5;
  return b === filter;
}

function reviewTags(item: MergedReviewItem): string[] {
  return item.kind === "file" ? item.review.tags : item.review.tags;
}

function matchesGenreFilter(
  item: MergedReviewItem,
  genre: "hypnosis" | "doujin" | null
): boolean {
  if (genre == null) return true;
  const tags = reviewTags(item);
  if (genre === "hypnosis") return tags.includes("催眠音声");
  return tags.includes("同人音声");
}

function matchesListScopeFilters(
  item: MergedReviewItem,
  genre: "hypnosis" | "doujin" | null,
  searchQuery: string
): boolean {
  return (
    matchesGenreFilter(item, genre) &&
    mergedReviewMatchesSearchQuery(item, searchQuery)
  );
}

function isFileReviewOnSale(item: MergedReviewItem): boolean {
  if (item.kind !== "file") return false;
  const id = item.review.dlsiteProductId?.trim();
  if (!id) return false;
  const product = getDlsiteProductById(id);
  if (!product || !isDlsitePriceFetched(product)) return false;
  return resolveDlsiteSaleDisplay(product).on_sale;
}

function sortMergedForSaleFilter(items: MergedReviewItem[]): MergedReviewItem[] {
  return [...items].sort((a, b) => {
    const starDiff =
      (b.kind === "file" ? b.review.ratingValue : b.review.ratingValue) -
      (a.kind === "file" ? a.review.ratingValue : a.review.ratingValue);
    if (starDiff !== 0) return starDiff;
    const pa =
      a.kind === "file" && a.review.dlsiteProductId
        ? getDlsiteProductById(a.review.dlsiteProductId)
        : undefined;
    const pb =
      b.kind === "file" && b.review.dlsiteProductId
        ? getDlsiteProductById(b.review.dlsiteProductId)
        : undefined;
    const disc = (pb?.discount_rate ?? 0) - (pa?.discount_rate ?? 0);
    if (disc !== 0) return disc;
    return publishedAtMs(b) - publishedAtMs(a);
  });
}

function countByGenre(
  merged: MergedReviewItem[],
  genre: "hypnosis" | "doujin" | null,
  searchQuery: string
): number {
  return merged.filter((i) => matchesListScopeFilters(i, genre, searchQuery))
    .length;
}

const SECTION_HYPNOSIS_INTRO = "hypnosis-intro";
const SECTION_AUTHOR_POSTS = "author-posts-heading";

const STAR_FILTER_LINKS = [
  { param: "10", label: "★10" },
  { param: "9", label: "★9" },
  { param: "8", label: "★8" },
  { param: "7", label: "★7" },
  { param: "6", label: "★6" },
  { param: "lte5", label: "★5〜" },
] as const;

function buildSearchHref(
  basePath: string,
  sp: URLSearchParams,
  patch: {
    genre?: "hypnosis" | "doujin" | null;
    stars?: string | null;
    clearStars?: boolean;
    sale?: boolean | null;
    clearSale?: boolean;
    sort?: "new" | "old";
    category?: ArticleListCategory | null;
  }
): string {
  const p = new URLSearchParams(sp.toString());
  if (patch.genre !== undefined) {
    if (patch.genre === null) p.delete("genre");
    else p.set("genre", patch.genre);
  }
  if (patch.category !== undefined) {
    if (patch.category === null) p.delete("category");
    else p.set("category", patch.category);
  }
  if (patch.clearStars === true) {
    p.delete("stars");
  } else if (patch.stars !== undefined && patch.stars !== null) {
    p.set("stars", patch.stars);
  }
  if (patch.clearSale === true || patch.sale === false) {
    p.delete("sale");
  } else if (patch.sale === true) {
    p.set("sale", "1");
    p.delete("stars");
  }
  if (patch.sort === "old") p.set("sort", "old");
  else if (patch.sort === "new") p.delete("sort");
  const qs = p.toString();
  const prefix = basePath === "/" ? "/" : basePath.replace(/\/?$/, "/");
  return qs ? `${prefix}?${qs}` : prefix;
}

/** 並び順と評価を同時に持たない（どちらか一方だけ） */
function hrefListSortNew(basePath: string, sp: URLSearchParams): string {
  return buildSearchHref(basePath, sp, {
    clearStars: true,
    clearSale: true,
    sort: "new",
  });
}

function hrefListSortOld(basePath: string, sp: URLSearchParams): string {
  return buildSearchHref(basePath, sp, {
    clearStars: true,
    clearSale: true,
    sort: "old",
  });
}

function hrefListStarOnly(
  basePath: string,
  sp: URLSearchParams,
  stars: string
): string {
  return buildSearchHref(basePath, sp, {
    stars,
    sort: "new",
    clearSale: true,
  });
}

function hrefListSaleOnly(basePath: string, sp: URLSearchParams): string {
  return buildSearchHref(basePath, sp, {
    sale: true,
    clearStars: true,
    sort: "new",
  });
}

/** 現在のジャンル（未選択は全件）に対する評価別件数（絞り込みバー用） */
function countsByStarFilter(
  merged: MergedReviewItem[],
  genre: "hypnosis" | "doujin" | null,
  searchQuery: string
): Record<"10" | "9" | "8" | "7" | "6" | "lte5", number> {
  const base = merged.filter((i) =>
    matchesListScopeFilters(i, genre, searchQuery)
  );
  return {
    "10": base.filter((i) => matchesStarFilter(i, 10)).length,
    "9": base.filter((i) => matchesStarFilter(i, 9)).length,
    "8": base.filter((i) => matchesStarFilter(i, 8)).length,
    "7": base.filter((i) => matchesStarFilter(i, 7)).length,
    "6": base.filter((i) => matchesStarFilter(i, 6)).length,
    lte5: base.filter((i) => matchesStarFilter(i, "lte5")).length,
  };
}

function LocalPostedCard({ review }: { review: PostedReview }) {
  const best = postedReviewRatingBest(review);
  const titleOne = reviewTitleSingleLine(review.title);
  const slug = `local-${review.id}`;
  const kind = effectivePostKind(review);
  const label = postedKindLabel(kind);
  const badgeClass =
    kind === "article"
      ? "text-emerald-400/95"
      : kind === "author_article"
        ? "text-sky-400/95"
        : kind === "mechanism"
          ? "text-violet-400/95"
          : "text-amber-300/95";

  return (
    <article>
      <Link
        href={`/reviews/local/${review.id}/`}
        className="group block min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-600/40 bg-slate-800/50 shadow-md shadow-slate-950/20 ring-1 ring-slate-700/30 transition hover:-translate-y-0.5 hover:border-sky-500/35 hover:shadow-lg hover:shadow-sky-950/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/45"
      >
        <div className="relative aspect-[16/9] min-h-0 min-w-0 w-full max-w-full overflow-hidden bg-slate-900 sm:aspect-[2/1]">
          {review.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 外部URL任意のため
            <img
              src={review.thumbnailUrl}
              alt={titleOne}
              className="h-full w-full object-cover"
            />
          ) : (
            <ReviewCoverPlaceholder slug={slug} />
          )}
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p
              className={`text-xs font-medium uppercase tracking-wider ${badgeClass}`}
            >
              ブラウザ保存 · {label}
            </p>
            <p className="text-xs tabular-nums text-slate-500">
              投稿 {formatPublishedAtForList(review.publishedAt)}
            </p>
          </div>
          <h2 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-slate-50 line-clamp-2 group-hover:text-sky-200">
            {titleOne}
          </h2>
          {isStarRatedReview(review) && (
            <div className="mt-3">
              <StarRating value={review.ratingValue} best={best} size="sm" />
            </div>
          )}
          <ul className="mt-4 flex flex-wrap gap-2">
            {review.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-lg border border-slate-600/50 bg-slate-900/55 px-2.5 py-1 text-xs font-medium text-sky-300/95"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      </Link>
    </article>
  );
}

type Props = {
  markdownReviews: Review[];
  /** 絞り込みの URL 基点（既定 `/`） */
  basePath?: string;
  /** レビュー一覧のみ（記事ブロック・ページ内リンクを非表示） */
  reviewsOnly?: boolean;
  /** 記事一覧のみ（レビューブロック非表示） */
  articlesOnly?: boolean;
  /** 記事一覧の見出し（articlesOnly 時） */
  listHeading?: string;
  /** 上マージンを抑える */
  compact?: boolean;
  /** 専用ハブで CategoryHubHeader を使うとき、一覧の h2 を隠す */
  hideListHeading?: boolean;
  /** 全年齢一覧：`goLiveAt` 前は「準備中」・本番ではリンク無効 */
  listPreparingMode?: boolean;
  /** ジャンル（催眠／同人）プルダウンを非表示 */
  hideGenreFilter?: boolean;
};

export function HomeReviewList({
  markdownReviews,
  basePath = "/",
  reviewsOnly = false,
  articlesOnly = false,
  listHeading = "記事一覧",
  compact = false,
  hideListHeading = false,
  listPreparingMode = false,
  hideGenreFilter = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listNow = useMemo(() => new Date(), []);
  const starsRaw = searchParams.get("stars");
  const starFilter: number | "lte5" | null =
    starsRaw === "lte5"
      ? "lte5"
      : starsRaw != null && /^([1-9]|10)$/.test(starsRaw)
        ? Number(starsRaw)
        : null;

  const genreRaw = searchParams.get("genre");
  const genreFilter: "hypnosis" | "doujin" | null =
    genreRaw === "hypnosis" || genreRaw === "doujin" ? genreRaw : null;

  const sortOrder: "new" | "old" =
    searchParams.get("sort") === "old" ? "old" : "new";

  const saleFilter = searchParams.get("sale") === "1";

  const voiceFilter = searchParams.get("voice");
  const toneFilter = parseVoiceActorToneId(searchParams.get("tone"));

  const categoryFilter = parseArticleListCategory(searchParams.get("category"));

  const searchQuery = normalizeReviewListSearchQuery(searchParams.get("q"));

  const [posted, setPosted] = useState<PostedReview[]>([]);

  const reloadPosted = useCallback(() => {
    setPosted(readPostedReviewsFromStorage());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.slice(1);
    const hasListQuery =
      searchParams.get("sale") === "1" ||
      Boolean(searchParams.get("stars")) ||
      Boolean(searchParams.get("sort")) ||
      Boolean(searchParams.get("genre")) ||
      Boolean(searchParams.get("voice")) ||
      Boolean(searchParams.get("tone")) ||
      Boolean(searchParams.get("category")) ||
      Boolean(normalizeReviewListSearchQuery(searchParams.get("q")));
    const shouldScrollToFilters =
      hasListQuery ||
      hash === REVIEWS_LIST_FILTERS_ID ||
      hash === REVIEWS_LIST_SECTION_ID;
    if (!shouldScrollToFilters) return;

    const scrollToFilters = () => {
      document.getElementById(REVIEWS_LIST_FILTERS_ID)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };
    requestAnimationFrame(() => {
      scrollToFilters();
      window.setTimeout(scrollToFilters, 120);
    });
  }, [searchParams]);

  useEffect(() => {
    reloadPosted();
    function onStorage(ev: StorageEvent) {
      if (ev.key === POSTED_REVIEWS_STORAGE_KEY || ev.key === null) {
        reloadPosted();
      }
    }
    function onLocalUpdate() {
      reloadPosted();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener(POSTED_REVIEWS_CHANGED_EVENT, onLocalUpdate);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(POSTED_REVIEWS_CHANGED_EVENT, onLocalUpdate);
    };
  }, [reloadPosted]);

  const markdownArticles = useMemo(
    () =>
      markdownReviews.filter(
        (r) =>
          r.contentKind === "article" && r.excludeFromArticleIndex !== true
      ),
    [markdownReviews]
  );

  const mergedReviews = useMemo(
    () => mergeReviews(markdownReviews, posted),
    [markdownReviews, posted]
  );

  const saleScopeCount = useMemo(
    () =>
      mergedReviews.filter(
        (i) =>
          matchesListScopeFilters(i, genreFilter, searchQuery) &&
          isFileReviewOnSale(i)
      ).length,
    [mergedReviews, genreFilter, searchQuery]
  );

  const filteredReviews = useMemo(() => {
    let list = mergedReviews.filter((item) =>
      matchesListScopeFilters(item, genreFilter, searchQuery)
    );
    if (saleFilter) {
      list = list.filter((item) => isFileReviewOnSale(item));
    }
    if (starFilter !== null) {
      list = list.filter((item) => matchesStarFilter(item, starFilter));
    }
    if (voiceFilter) {
      list = list.filter(
        (item) =>
          item.kind === "file" &&
          reviewMatchesVoiceActorName(item.review, voiceFilter)
      );
    }
    if (toneFilter) {
      list = list.filter(
        (item) =>
          item.kind === "file" &&
          reviewMatchesVoiceActorTone(item.review, toneFilter)
      );
    }
    if (saleFilter) {
      return sortMergedForSaleFilter(list);
    }
    const effectiveSort: "new" | "old" =
      starFilter !== null ? "new" : sortOrder;
    let sorted = sortMergedByPublishedAt(list, effectiveSort);
    if (voiceFilter) {
      let voiceName = voiceFilter;
      try {
        voiceName = decodeURIComponent(voiceFilter);
      } catch {
        /* keep raw */
      }
      const featured = featuredSlugsForVoiceActor(voiceName);
      if (featured.length > 0) {
        const order = sortReviewSlugsWithFeatured(
          sorted
            .filter((i) => i.kind === "file")
            .map((i) => i.review.slug),
          featured
        );
        const rank = new Map(order.map((slug, i) => [slug, i]));
        sorted = [...sorted].sort((a, b) => {
          const sa = a.kind === "file" ? rank.get(a.review.slug) : undefined;
          const sb = b.kind === "file" ? rank.get(b.review.slug) : undefined;
          if (sa != null && sb != null) return sa - sb;
          if (sa != null) return -1;
          if (sb != null) return 1;
          return 0;
        });
      }
    }
    return sorted;
  }, [
    mergedReviews,
    genreFilter,
    starFilter,
    sortOrder,
    saleFilter,
    voiceFilter,
    toneFilter,
    searchQuery,
  ]);

  const starCountsForFilter = useMemo(
    () => countsByStarFilter(mergedReviews, genreFilter, searchQuery),
    [mergedReviews, genreFilter, searchQuery]
  );

  const listScopeCount = useMemo(
    () => countByGenre(mergedReviews, genreFilter, searchQuery),
    [mergedReviews, genreFilter, searchQuery]
  );

  const articlePosts = useMemo(() => {
    return posted
      .filter((p) => {
        const k = effectivePostKind(p);
        return k === "article" || k === "author_article";
      })
      .sort(
        (a, b) =>
          Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
      );
  }, [posted]);

  const combinedArticleEntries = useMemo(() => {
    type Entry =
      | { source: "file"; review: Review; t: number }
      | { source: "local"; post: PostedReview; t: number };
    const fromFile: Entry[] = markdownArticles.map((review) => ({
      source: "file",
      review,
      t: reviewPublicationTimeMs(review),
    }));
    const fromLocal: Entry[] = articlePosts.map((post) => ({
      source: "local",
      post,
      t: Date.parse(post.publishedAt),
    }));
    return [...fromFile, ...fromLocal].sort(
      (a, b) => (Number.isNaN(b.t) ? 0 : b.t) - (Number.isNaN(a.t) ? 0 : a.t)
    );
  }, [markdownArticles, articlePosts]);

  type ArticleEntry =
    | { source: "file"; review: Review; t: number }
    | { source: "local"; post: PostedReview; t: number };

  const filteredArticleEntries = useMemo(() => {
    const matchesCategory = (tags: string[]) =>
      articleTagsMatchCategory(tags, categoryFilter);

    let list: ArticleEntry[] = combinedArticleEntries.filter((entry) => {
      const tags =
        entry.source === "file" ? entry.review.tags : entry.post.tags;
      return matchesCategory(tags);
    });

    list = [...list].sort((a, b) => {
      const diff = (Number.isNaN(b.t) ? 0 : b.t) - (Number.isNaN(a.t) ? 0 : a.t);
      return sortOrder === "old" ? -diff : diff;
    });

    return list;
  }, [combinedArticleEntries, categoryFilter, sortOrder]);

  const articleCategoryCounts = useMemo(() => {
    const countFor = (cat: ArticleListCategory | null) =>
      combinedArticleEntries.filter((entry) => {
        const tags =
          entry.source === "file" ? entry.review.tags : entry.post.tags;
        return articleTagsMatchCategory(tags, cat);
      }).length;

    return {
      all: combinedArticleEntries.length,
      listening: countFor("listening"),
      guide: countFor("guide"),
      recommend: countFor("recommend"),
    };
  }, [combinedArticleEntries]);

  const articleScopeCount = useMemo(() => {
    return combinedArticleEntries.filter((entry) => {
      const tags =
        entry.source === "file" ? entry.review.tags : entry.post.tags;
      return articleTagsMatchCategory(tags, categoryFilter);
    }).length;
  }, [combinedArticleEntries, categoryFilter]);

  const genrePillCounts = useMemo(
    () => ({
      all: countByGenre(mergedReviews, null, searchQuery),
      hypnosis: countByGenre(mergedReviews, "hypnosis", searchQuery),
      doujin: countByGenre(mergedReviews, "doujin", searchQuery),
    }),
    [mergedReviews, searchQuery]
  );

  const hasAnyContent = articlesOnly
    ? markdownArticles.length > 0 || articlePosts.length > 0
    : reviewsOnly
      ? mergedReviews.length > 0
      : mergedReviews.length > 0 ||
        markdownArticles.length > 0 ||
        articlePosts.length > 0;

  if (!hasAnyContent) {
    return (
      <p className="mx-auto mt-16 max-w-xl rounded-3xl border border-dashed border-slate-600/50 bg-slate-800/45 p-8 text-center text-sm leading-relaxed text-slate-400 shadow-inner shadow-slate-950/20">
        まだ表示できる投稿がありません。Markdown を{" "}
        <code className="rounded-md border border-slate-600/60 bg-slate-900 px-2 py-0.5 font-mono text-xs text-sky-200/90">
          src/content/レビュー/
        </code>{" "}
        または{" "}
        <code className="rounded-md border border-slate-600/60 bg-slate-900 px-2 py-0.5 font-mono text-xs text-sky-200/90">
          src/content/記事/
        </code>{" "}
        のフォルダ内に{" "}
        <code className="rounded-md border border-slate-600/60 bg-slate-900 px-2 py-0.5 font-mono text-xs text-sky-200/90">
          index.md
        </code>{" "}
        として置くか、同一ブラウザで{" "}
        <code className="rounded-md border border-slate-600/60 bg-slate-900 px-2 py-0.5 font-mono text-xs text-sky-200/90">
          /admin
        </code>{" "}
        （パスワード保護）から投稿すると一覧に表示されます。
      </p>
    );
  }

  const filterBarWrap =
    "mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-600/45 bg-slate-800/50 px-4 py-3.5 shadow-md shadow-slate-950/25 ring-1 ring-slate-700/30 sm:mb-4 sm:gap-3 sm:px-5 sm:py-4";
  const filterBarLabel =
    "shrink-0 text-sm font-medium text-slate-300 sm:text-[0.9375rem]";
  const selectBase =
    "min-h-9 rounded-full border border-violet-400/45 bg-slate-900/70 px-3.5 py-1.5 text-sm font-medium text-violet-100 shadow-sm shadow-slate-950/20 transition hover:border-fuchsia-400/50 hover:bg-slate-800/90 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/45";
  const currentSortKey = articlesOnly
    ? sortOrder === "old"
      ? "old"
      : "new"
    : saleFilter
      ? "sale"
      : starFilter === null
        ? sortOrder === "old"
          ? "old"
          : "new"
        : String(starsRaw);
  const currentGenreKey = genreFilter ?? "all";
  const currentArticleCategoryKey = categoryFilter ?? "all";
  const listSectionId = articlesOnly ? "articles-heading" : "reviews-heading";
  const listSectionTitle = articlesOnly ? listHeading : "レビュー一覧";

  const outerClass = compact
    ? "mt-0 space-y-0"
    : "mt-14 space-y-16 sm:mt-16 sm:space-y-20";
  const innerClass = compact ? "min-w-0 space-y-0" : "min-w-0 space-y-16 sm:space-y-20";

  return (
    <div className={outerClass}>
      <div className={innerClass}>
        <section
          aria-labelledby={hideListHeading ? undefined : listSectionId}
          aria-label={hideListHeading ? "作品レビュー一覧" : undefined}
        >
          <div className={compact ? "mb-4 space-y-3" : "mb-6 space-y-3 sm:mb-7 sm:space-y-3.5"}>
            <div
              id={REVIEWS_LIST_FILTERS_ID}
              className={`scroll-mt-24 sm:scroll-mt-28 ${filterBarWrap}`}
              role="group"
              aria-label={articlesOnly ? "絞り込みとカテゴリ" : "絞り込みとジャンル"}
            >
              <span className={filterBarLabel}>絞り込み:</span>
              <select
                aria-label={articlesOnly ? "並び順" : "並び順と評価"}
                className={selectBase}
                value={currentSortKey}
                onChange={(e) => {
                  const next = e.currentTarget.value;
                  const href = articlesOnly
                    ? next === "old"
                      ? buildSearchHref(basePath, searchParams, { sort: "old" })
                      : buildSearchHref(basePath, searchParams, { sort: "new" })
                    : next === "new"
                      ? hrefListSortNew(basePath, searchParams)
                      : next === "old"
                        ? hrefListSortOld(basePath, searchParams)
                        : next === "sale"
                          ? hrefListSaleOnly(basePath, searchParams)
                          : hrefListStarOnly(basePath, searchParams, next);
                  router.push(href, { scroll: false });
                }}
              >
                {articlesOnly ? (
                  <>
                    <option value="new">新しい順（{articleScopeCount}）</option>
                    <option value="old">古い順（{articleScopeCount}）</option>
                  </>
                ) : (
                  <>
                    <option value="new">新しい順（{listScopeCount}）</option>
                    <option value="old">古い順（{listScopeCount}）</option>
                    <option value="sale">セール中（{saleScopeCount}）</option>
                    {STAR_FILTER_LINKS.map(({ param, label }) => {
                      const countKey =
                        param === "lte5"
                          ? ("lte5" as const)
                          : (param as "10" | "9" | "8" | "7" | "6");
                      const count = starCountsForFilter[countKey];
                      return (
                        <option key={param} value={param}>
                          {label}（{count}）
                        </option>
                      );
                    })}
                  </>
                )}
              </select>
              {articlesOnly ? (
                <>
                  <span className={filterBarLabel}>カテゴリ:</span>
                  <select
                    aria-label="カテゴリ"
                    className={selectBase}
                    value={currentArticleCategoryKey}
                    onChange={(e) => {
                      const next = e.currentTarget.value;
                      const href = buildSearchHref(basePath, searchParams, {
                        category:
                          next === "listening" ||
                          next === "guide" ||
                          next === "recommend"
                            ? next
                            : null,
                      });
                      router.push(href, { scroll: false });
                    }}
                  >
                    <option value="all">全て（{articleCategoryCounts.all}）</option>
                    <option value="listening">
                      {ARTICLE_LIST_CATEGORY_LABELS.listening}（
                      {articleCategoryCounts.listening}）
                    </option>
                    <option value="guide">
                      {ARTICLE_LIST_CATEGORY_LABELS.guide}（
                      {articleCategoryCounts.guide}）
                    </option>
                    <option value="recommend">
                      {ARTICLE_LIST_CATEGORY_LABELS.recommend}（
                      {articleCategoryCounts.recommend}）
                    </option>
                  </select>
                </>
              ) : hideGenreFilter ? null : (
                <>
                  <span className={filterBarLabel}>ジャンル:</span>
                  <select
                    aria-label="ジャンル"
                    className={selectBase}
                    value={currentGenreKey}
                    onChange={(e) => {
                      const next = e.currentTarget.value;
                      const href = buildSearchHref(basePath, searchParams, {
                        genre:
                          next === "hypnosis" || next === "doujin" ? next : null,
                      });
                      router.push(href, { scroll: false });
                    }}
                  >
                    <option value="all">全て（{genrePillCounts.all}）</option>
                    <option value="hypnosis">
                      催眠音声（{genrePillCounts.hypnosis}）
                    </option>
                    <option value="doujin">
                      同人音声（{genrePillCounts.doujin}）
                    </option>
                  </select>
                </>
              )}
            </div>

            {!reviewsOnly && !articlesOnly ? (
              <p className="text-xs leading-relaxed text-slate-500">
                <span className="text-slate-400">ページ内:</span>{" "}
                <Link
                  href={`/#${SECTION_HYPNOSIS_INTRO}`}
                  className="text-sky-400/95 underline-offset-2 hover:text-sky-300 hover:underline"
                >
                  催眠音声入門
                </Link>
                {" · "}
                <Link
                  href="/articles/"
                  className="text-sky-400/95 underline-offset-2 hover:text-sky-300 hover:underline"
                >
                  記事一覧
                </Link>
              </p>
            ) : null}
          </div>

          {hideListHeading ? (
            <p className="mb-5 text-sm text-slate-500">
              {filteredReviews.length} 件
              {(starFilter !== null ||
                genreFilter !== null ||
                saleFilter ||
                voiceFilter ||
                toneFilter ||
                searchQuery ||
                sortOrder === "old") &&
              mergedReviews.length > 0
                ? ` / 全レビュー ${mergedReviews.length} 件`
                : null}
              {searchQuery ? (
                <>
                  {" "}
                  · キーワード「{searchQuery}」
                </>
              ) : null}
            </p>
          ) : null}

          {hideListHeading ? null : (
          <div className={compact ? "mb-5" : "mb-8 sm:mb-10"}>
            <h2
              id={listSectionId}
              className={
                compact
                  ? "scroll-mt-20 text-lg font-bold tracking-tight text-slate-50"
                  : "scroll-mt-24 text-xl font-bold tracking-tight text-slate-50 sm:scroll-mt-28 sm:text-2xl"
              }
            >
              {listSectionTitle}
              {articlesOnly
                ? (() => {
                    const parts: string[] = [];
                    if (categoryFilter != null) {
                      parts.push(ARTICLE_LIST_CATEGORY_LABELS[categoryFilter]);
                    }
                    if (sortOrder === "old") parts.push("古い順");
                    if (parts.length === 0) return null;
                    return (
                      <span className="text-lg font-semibold text-sky-300">
                        {" "}
                        （{parts.join(" · ")}）
                      </span>
                    );
                  })()
                : (() => {
                    const parts: string[] = [];
                if (genreFilter === "hypnosis") parts.push("催眠音声");
                if (genreFilter === "doujin") parts.push("同人音声");
                if (saleFilter) parts.push("セール中");
                if (sortOrder === "old" && starFilter === null && !saleFilter) {
                  parts.push("古い順");
                }
                if (starFilter !== null) {
                  parts.push(
                    starFilter === "lte5" ? "★5〜" : `★${starFilter}`
                  );
                }
                if (voiceFilter) {
                  try {
                    parts.push(decodeURIComponent(voiceFilter));
                  } catch {
                    parts.push(voiceFilter);
                  }
                }
                if (toneFilter) {
                  parts.push(VOICE_ACTOR_TONE_LABELS[toneFilter]);
                }
                    if (parts.length === 0) return null;
                    return (
                      <span className="text-lg font-semibold text-sky-300">
                        {" "}
                        （{parts.join(" · ")}）
                      </span>
                    );
                  })()}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {articlesOnly ? filteredArticleEntries.length : filteredReviews.length} 件
              {articlesOnly
                ? (categoryFilter != null || sortOrder === "old") &&
                  combinedArticleEntries.length > 0
                  ? ` / 全記事 ${combinedArticleEntries.length} 件`
                  : null
                : (starFilter !== null ||
                    genreFilter !== null ||
                    saleFilter ||
                    voiceFilter ||
                    toneFilter ||
                    sortOrder === "old") &&
                  mergedReviews.length > 0
                  ? ` / 全レビュー ${mergedReviews.length} 件`
                  : null}
            </p>
          </div>
          )}

          {articlesOnly ? (
            filteredArticleEntries.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-600/50 bg-slate-800/40 px-4 py-10 text-center text-sm text-slate-500">
                記事がありません。上の「絞り込み」で並び順やカテゴリを変えると表示件数が変わります。
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-10">
                {filteredArticleEntries.map((entry, index) => (
                  <li
                    key={
                      entry.source === "file" ? entry.review.slug : entry.post.id
                    }
                    className="min-w-0"
                  >
                    {entry.source === "file" ? (
                      <FileMarkdownArticleCard
                        review={entry.review}
                        priorityImage={index < 2}
                        showNew={isReviewNewPublication(
                          entry.review,
                          new Date()
                        )}
                      />
                    ) : (
                      <LocalPostedCard review={entry.post} />
                    )}
                  </li>
                ))}
              </ul>
            )
          ) : filteredReviews.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-600/50 bg-slate-800/40 px-4 py-10 text-center text-sm text-slate-500">
              {searchQuery
                ? `「${searchQuery}」に一致するレビューは見つかりませんでした。キーワードを変えるか、上の「絞り込み」を緩めてください。`
                : saleFilter
                  ? "セール中の掲載はまだありません。上の「絞り込み」で「新しい順」などを選ぶと一覧が変わります。"
                  : starFilter !== null
                    ? `${
                        starFilter === "lte5" ? "★5〜" : `★${starFilter}`
                      }のレビューはまだありません。上の「絞り込み」で「新しい順」「古い順」または別の星を選ぶと表示件数が変わります。`
                    : "レビューがありません。"}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-10">
              {filteredReviews.map((item, index) => (
                <li
                  key={item.kind === "file" ? item.review.slug : item.review.id}
                  className="min-w-0"
                >
                  {item.kind === "file" ? (
                    <ReviewCard
                      review={item.review}
                      priorityImage={index < 2}
                      showNew={isReviewNewPublication(item.review, listNow)}
                      draft={isOwnerDraftReview(item.review)}
                      preparing={
                        listPreparingMode &&
                        !isReviewVisibleByGoLiveAt(item.review, listNow)
                      }
                      linkable={
                        !listPreparingMode ||
                        isReviewVisibleOnSite(item.review, listNow)
                      }
                    />
                  ) : (
                    <LocalPostedCard review={item.review} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {!reviewsOnly && !articlesOnly ? (
        <section aria-labelledby="author-posts-heading">
          <div className="mb-8 sm:mb-10">
            <h2
              id="author-posts-heading"
              className="scroll-mt-24 text-xl font-bold tracking-tight text-slate-50 sm:scroll-mt-28 sm:text-2xl"
            >
              記事一覧
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {combinedArticleEntries.length} 件
            </p>
          </div>
          {combinedArticleEntries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-600/50 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-500">
              記事はまだありません。{" "}
              <code className="rounded bg-slate-800 px-1 font-mono text-xs">
                src/content/記事/
              </code>{" "}
              のフォルダに{" "}
              <code className="rounded bg-slate-800 px-1 font-mono text-xs">
                index.md
              </code>{" "}
              を置き、フロントマターに{" "}
              <code className="rounded bg-slate-800 px-1 font-mono text-xs">
                contentKind: article
              </code>{" "}
              を付けるか、/admin から「記事」として投稿できます。
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:gap-10">
              {combinedArticleEntries.map((entry, index) => (
                <li key={entry.source === "file" ? entry.review.slug : entry.post.id} className="min-w-0">
                  {entry.source === "file" ? (
                    <FileMarkdownArticleCard
                      review={entry.review}
                      priorityImage={index < 2}
                      showNew={isReviewNewPublication(entry.review, new Date())}
                    />
                  ) : (
                    <LocalPostedCard review={entry.post} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        ) : null}
      </div>
    </div>
  );
}
