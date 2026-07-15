import type { Metadata } from "next";
import BananaSlug from "github-slugger";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AffiliateButton, AffiliateButtonGroup } from "@/components/AffiliateButton";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { ReviewCover } from "@/components/ReviewCover";
import { ReviewJsonLd } from "@/components/ReviewJsonLd";
import { ArticleNextNav } from "@/components/ArticleNextNav";
import { ReviewMarkdown } from "@/components/ReviewMarkdown";
import { SummaryMarkdown } from "@/components/SummaryMarkdown";
import { StarRating } from "@/components/StarRating";
import { ReviewHeaderBadges } from "@/components/ReviewHeaderBadges";
import { DlsitePricePanel } from "@/components/DlsitePricePanel";
import {
  REVIEW_DETAIL_MODE_BUTTON_LABEL,
  ReviewModeSwitcher,
} from "@/components/ReviewModeSwitcher";
import { MatureContentNotice } from "@/components/MatureContentNotice";
import { resolveSocialPreviewImage, siteUrl } from "@/lib/og-metadata";
import { isReviewNewPublication } from "@/lib/review-new-badge";
import {
  articlePublishedTimeIso,
  effectiveDisplayPublishedIsoDate,
  formatPublishedAtForList,
  formatSaleDateJapanese,
} from "@/lib/format-published-at";
import {
  getAllAgesReviews,
  getAllReviews,
  getAllSlugs,
  getReviewBySlug,
  isAllAgesReview,
  isOwnerDraftReview,
  isReviewVisibleOnSite,
} from "@/lib/reviews";
import { extractDryWetCounts } from "@/lib/extractDryWetCounts";
import {
  splitBeforeAtRecommendedAudience,
  splitBodyAtFinalRating,
  splitRatingAtWorkIntroLabel,
  splitRestAfterWorkImpression,
  splitBodyForArticleMode,
} from "@/lib/split-review-body";
import { reviewTitleSingleLine } from "@/lib/review-title";
import { stripMarkdownForMeta } from "@/lib/strip-markdown-lite";
import {
  getDlsiteProductById,
  isDlsiteProductShinsaku,
  resolveDlsiteSaleDisplay,
} from "@/lib/dlsite-product-catalog";
import { getDlsiteRankingBadgesForProduct } from "@/lib/dlsite-ranking-catalog";
import { resolveDlsiteAffiliateHref } from "@/lib/resolve-dlsite-affiliate-href";
import type { AffiliateLink, Review } from "@/lib/types";
import { resolveReviewBackLink } from "@/lib/review-back-link";
import { quickGuideBySlug } from "@/lib/quick-guide-by-slug";

type Props = { params: Promise<{ slug: string }> };

function extractH2Headings(markdown: string): Array<{ label: string; id: string }> {
  const slugger = new BananaSlug();
  const rows: Array<{ label: string; id: string }> = [];
  const normalized = markdown.replace(/\r\n/g, "\n");
  const matches = normalized.matchAll(/^##\s+(.+)$/gm);
  for (const m of matches) {
    const label = (m[1] ?? "").trim();
    if (!label) continue;
    rows.push({ label, id: slugger.slug(label) });
  }
  return rows;
}

function formatGoLiveForReader(goLiveAt: string): string {
  const s = goLiveAt.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  const iso = dateOnly.test(s) ? `${s}T00:00:00.000Z` : s;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return s;
  return new Date(t).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 文頭サマリー横。フロントマターのラベルをそのまま表示する */
function affiliateLinksHeader(links: AffiliateLink[]): AffiliateLink[] {
  return links;
}

/** 「総合評価」横ボタン用。先頭リンクのラベルを体験版導線に統一 */
function affiliateLinksBesideRating(links: AffiliateLink[]): AffiliateLink[] {
  return links.map((l, i) =>
    i === 0 ? { ...l, label: "体験版はこちら" } : l
  );
}

function normalizeZenkakuDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

function extractCircleName(markdown?: string): string | null {
  if (!markdown) return null;
  const normalized = markdown.replace(/\r\n/g, "\n");
  const m = normalized.match(/^- \*\*サークル：\*\*\s*(.+)$/m);
  if (!m?.[1]) return null;
  return m[1].replace(/\s*（.*?）\s*$/u, "").trim() || null;
}

/** フロントマター `circleName` があれば優先。なければ本文 `### 基本情報` のサークル行から抽出 */
function effectiveCircleName(review: Review): string | null {
  const fromFm = review.circleName?.trim();
  if (fromFm) {
    const cleaned = fromFm.replace(/\s*（.*?）\s*$/u, "").trim();
    return cleaned || null;
  }
  return extractCircleName(review.body);
}

function extractInductionRatioVector(markdown?: string): number[] {
  if (!markdown) return [];
  const normalized = markdown.replace(/\r\n/g, "\n");
  const block = normalized.match(/###\s*誘導構成比([\s\S]*?)(?:\n###\s|\n##\s|$)/);
  if (!block?.[1]) return [];

  const values: number[] = [];
  const lines = block[1].split("\n");
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    if (line.includes("---")) continue;
    const cells = line.split("|").map((v) => v.trim());
    // [0] が空、[1] 項目名、[2] 数値、[3] 説明、[4] が空 になる想定
    const valueRaw = cells[2];
    if (!valueRaw) continue;
    const n = Number(valueRaw);
    if (Number.isFinite(n)) values.push(n);
  }
  return values;
}

function inductionDistance(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return Number.POSITIVE_INFINITY;
  const len = Math.min(a.length, b.length);
  if (len === 0) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < len; i += 1) {
    sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  }
  return sum / len;
}

function pickRelatedReviews(current: Review): Review[] {
  if (!current.body || current.contentKind !== "review") return [];
  const pool = isAllAgesReview(current) ? getAllAgesReviews() : getAllReviews();
  const all = pool.filter((r) => r.contentKind === "review" && r.slug !== current.slug);

  const currentCircle = effectiveCircleName(current);
  const currentVector = extractInductionRatioVector(current.body);

  return all
    .map((candidate) => {
      const circle = effectiveCircleName(candidate);
      const vector = extractInductionRatioVector(candidate.body);
      const sameCircle = currentCircle && circle ? circle === currentCircle : false;
      return {
        candidate,
        sameCircle,
        distance: inductionDistance(currentVector, vector),
      };
    })
    .sort((a, b) => {
      if (a.sameCircle !== b.sameCircle) return a.sameCircle ? -1 : 1;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return (
        Date.parse(b.candidate.publishedAt) - Date.parse(a.candidate.publishedAt)
      );
    })
    .slice(0, 4)
    .map((v) => v.candidate);
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const review = getReviewBySlug(slug);
  if (!review) return { title: "見つかりません" };

  const title = reviewTitleSingleLine(review.title);
  const now = new Date();
  if (!isReviewVisibleOnSite(review, now)) {
    return {
      title: `${title}（公開予定）`,
      description: "このページは予約公開前です。",
      robots: { index: false, follow: false },
    };
  }

  const publishedTimeIso = articlePublishedTimeIso(review);
  const description =
    stripMarkdownForMeta(review.summary) || title;
  const url = `${siteUrl()}/reviews/${slug}/`;
  const { url: imageUrl, alt: imageAlt } = resolveSocialPreviewImage(review);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      publishedTime: publishedTimeIso,
      images: [{ url: imageUrl, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    alternates: { canonical: url },
  };
}

export default async function ReviewPage({ params }: Props) {
  const { slug } = await params;
  const review = getReviewBySlug(slug);
  if (!review) notFound();

  const backLink = resolveReviewBackLink(review);
  const now = new Date();
  if (!isReviewVisibleOnSite(review, now)) {
    const titleOne = reviewTitleSingleLine(review.title);
    const when = !review.publishedAt?.trim()
      ? "投稿日未定"
      : review.goLiveAt?.trim()
        ? formatGoLiveForReader(review.goLiveAt)
        : "予定時刻が設定されていません";
    return (
      <article className="mx-auto w-full min-w-0 max-w-3xl py-8 sm:py-10 lg:max-w-4xl xl:max-w-5xl xl:py-11">
        <Link
          href={backLink.href}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 transition hover:text-sky-200"
        >
          <span aria-hidden>←</span> {backLink.label}
        </Link>
        <header className="mt-8 rounded-3xl border border-amber-700/35 bg-slate-800/60 px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
            予約公開
          </p>
          <h1 className="mt-2 text-xl font-bold leading-snug text-slate-50 sm:text-2xl">
            {titleOne}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            このレビューはまだ公開開始前です。本文は公開日時以降に表示されます。
          </p>
          <p className="mt-3 text-sm tabular-nums text-slate-300">
            公開予定（目安）：{when}
          </p>
          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            本番（静的エクスポート）では<strong>ビルドを実行した瞬間</strong>が公開判定に使われます。予約時刻のあとに本番ビルドが走るまで本文は出ません（サーバーが時刻で切り替える方式ではありません）。日次は GitHub
            Actions が概ね JST 21:05・22:00 に Vercel へ再デプロイをかける想定です。出ないときは Actions の成否と、リポジトリの{" "}
            <code className="rounded bg-slate-900/80 px-1">VERCEL_DEPLOY_HOOK_URL</code>{" "}
            設定を確認してください。
          </p>
        </header>
      </article>
    );
  }

  const displayPublishedIso = effectiveDisplayPublishedIsoDate(
    review.publishedAt,
    review.goLiveAt
  );
  const displayPublishedLabel =
    formatPublishedAtForList(displayPublishedIso);
  const displayUpdatedIso = review.updatedAt?.trim();
  const showUpdatedLabel = Boolean(
    displayUpdatedIso && displayUpdatedIso !== displayPublishedIso
  );
  const displayUpdatedLabel = displayUpdatedIso
    ? formatPublishedAtForList(displayUpdatedIso)
    : "";
  const isDraftPreview = isOwnerDraftReview(review);

  const canonicalUrl = `${siteUrl()}/reviews/${review.slug}/`;
  const best = review.ratingBest ?? 10;

  const isArticle = review.contentKind === "article";
  const isHypnosisReview =
    review.authorName === "催眠音声解析室" ||
    review.tags?.includes("催眠音声") === true;
  const isDoujinReview =
    !isHypnosisReview &&
    (review.authorName === "同人音声レビュー室" ||
      review.authorName === "同人音声解析室" ||
      review.tags?.includes("同人音声") === true ||
      review.tags?.includes("全年齢同人") === true);
  const quickSpecTypeLabel = isDoujinReview ? "シチュエーション" : "誘導タイプ";
  const titleHasBreak = review.title.includes("\n");
  const nextReview = review.nextSlug
    ? getReviewBySlug(review.nextSlug)
    : undefined;

  const dlsiteProduct =
    !isArticle && review.dlsiteProductId != null
      ? getDlsiteProductById(review.dlsiteProductId)
      : undefined;
  const dlsiteSaleDisplay = dlsiteProduct
    ? resolveDlsiteSaleDisplay(dlsiteProduct)
    : undefined;

  const nowBadges = new Date();
  const showNewBadge = isReviewNewPublication(review, nowBadges);
  const showShinsakuBadge =
    !isArticle && isDlsiteProductShinsaku(dlsiteProduct, nowBadges);
  const dlsiteRankingBadges =
    !isArticle
      ? getDlsiteRankingBadgesForProduct(review.dlsiteProductId)
      : [];
  const showHeaderBadges =
    showNewBadge ||
    showShinsakuBadge ||
    dlsiteRankingBadges.length > 0;
  const relatedReviews = pickRelatedReviews(review);

  const coverEl = (
    <ReviewCover
      coverImage={review.coverImage}
      alt={reviewTitleSingleLine(review.title)}
      slug={review.slug}
      priority
      variant="hero"
      className="rounded-none"
    />
  );

  const finalRatingSplit = review.body
    ? splitBodyAtFinalRating(review.body)
    : null;
  const articleModeSplit = review.body
    ? splitBodyForArticleMode(review.body)
    : null;
  const analysisDataMarkdown = articleModeSplit?.analysisDataMarkdown;
  const detailRestMarkdown =
    articleModeSplit?.detailRestMarkdown ?? finalRatingSplit?.rest ?? "";
  const restWorkSplit =
    detailRestMarkdown.trim().length > 0
      ? splitRestAfterWorkImpression(detailRestMarkdown)
      : null;
  const ratingParts = finalRatingSplit?.rating
    ? splitRatingAtWorkIntroLabel(finalRatingSplit.rating)
    : { core: "", workIntro: "" };
  const recommendedAudienceSplit =
    !isArticle && finalRatingSplit?.before
      ? splitBeforeAtRecommendedAudience(finalRatingSplit.before)
      : null;
  const showAffiliateBesideRating =
    Boolean(finalRatingSplit) && review.affiliateLinks.length > 0;
  const bodyH2Headings = review.body
    ? extractH2Headings(review.body).filter(
        (h) => h.label !== "作品名" && h.label !== "どんな人におすすめか"
      )
    : [];
  const finalRatingHeadingId =
    bodyH2Headings.find((h) => h.label === "総合評価")?.id ?? "final-rating-heading";
  const quickGuideSpec = quickGuideBySlug[review.slug];
  const enableTwoModeReview = Boolean(quickGuideSpec);
  const quickSaleDateLabel = review.saleDate
    ? formatSaleDateJapanese(review.saleDate)
    : "未記入";
  const quickCircleNameLabel = effectiveCircleName(review) ?? "未記入";
  const quickDryWetCounts = extractDryWetCounts(review.body);
  const quickDiscountLabel = dlsiteSaleDisplay?.on_sale
    ? `今なら${dlsiteSaleDisplay.discount_rate}%OFF`
    : "価格はページでご確認ください";
  const quickAffiliateHref = resolveDlsiteAffiliateHref(review) ?? "#";
  const trialAffiliateHref = review.affiliateLinks.find((link) =>
    /体験版|サンプル/.test(String(link.label ?? ""))
  )?.href;
  const quickSampleHref =
    trialAffiliateHref && trialAffiliateHref !== quickAffiliateHref
      ? trialAffiliateHref
      : undefined;

  return (
    <>
      {!isArticle && (
        <ReviewJsonLd
          review={review}
          canonicalUrl={canonicalUrl}
          dlsiteProduct={dlsiteProduct}
        />
      )}
      <article
        className={`mx-auto w-full min-w-0 max-w-3xl py-8 sm:py-10 lg:max-w-4xl xl:max-w-5xl xl:py-11 ${isArticle ? "article-reading" : "review-reading"}`}
      >
        <Link
          href={backLink.href}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-sky-300 transition hover:text-sky-200"
        >
          <span aria-hidden>←</span> {backLink.label}
        </Link>

        {isDraftPreview ? (
          <p
            role="status"
            className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm leading-relaxed text-amber-100/95"
          >
            下書きプレビューです。読者向けの一覧・サイトマップ・本番ビルドでは表示されません。投稿日を設定すると公開できます。
          </p>
        ) : null}

        {!isAllAgesReview(review) && review.contentKind === "review" ? (
          <MatureContentNotice context="review" className="mt-5" />
        ) : null}

        <header className="mt-5 sm:mt-6">
          <div
            className={`overflow-hidden rounded-3xl border border-slate-600/45 bg-slate-800/50 shadow-lg shadow-slate-950/25 backdrop-blur-sm ${isArticle ? "article-hero-card" : ""}`}
          >
            {review.coverAffiliateHref ? (
              <a
                href={review.coverAffiliateHref}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                className="block rounded-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/50"
                aria-label={`${review.itemName}の作品ページを開く`}
              >
                {coverEl}
              </a>
            ) : (
              coverEl
            )}
            <div
              className={`border-t border-slate-600/40 bg-slate-900/50 py-6 sm:px-8 sm:py-8 ${
                isArticle
                  ? "px-5 max-sm:px-5 max-sm:pb-7 max-sm:pt-6"
                  : "px-4"
              }`}
            >
              <div className="flex flex-col gap-3 sm:gap-4">
                {showHeaderBadges ? (
                  <ReviewHeaderBadges
                    showNew={showNewBadge}
                    showShinsaku={showShinsakuBadge}
                    rankingEntries={dlsiteRankingBadges}
                  />
                ) : null}
                <h1
                  className={`w-full min-w-0 text-2xl font-bold leading-snug tracking-tight text-slate-50 sm:text-3xl sm:leading-tight ${isArticle || titleHasBreak ? "whitespace-pre-line text-pretty" : "text-balance"} ${isArticle ? "max-sm:text-[1.7rem] max-sm:leading-snug" : ""}`}
                >
                  {review.title}
                </h1>
              </div>
              <div
                className={`mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 ${!isArticle ? "sm:justify-between" : ""}`}
              >
                {!isArticle && (
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1.5">
                    <StarRating value={review.ratingValue} best={best} size="md" />
                    <Link
                      href="/evaluation-method/"
                      className="inline-flex min-h-9 items-center text-xs text-slate-500 underline decoration-slate-600 underline-offset-2 transition hover:text-sky-300 sm:min-h-0"
                    >
                      採点基準について
                    </Link>
                  </div>
                )}
                <p
                  className={`flex flex-col gap-0.5 text-sm leading-relaxed text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-0 sm:leading-normal ${isArticle ? "sm:ml-auto" : ""}`}
                >
                  <span className="flex flex-wrap items-center gap-x-2">
                    <time dateTime={displayPublishedIso}>
                      {showUpdatedLabel
                        ? `公開 ${displayPublishedLabel}`
                        : displayPublishedLabel}
                    </time>
                    {showUpdatedLabel && displayUpdatedIso ? (
                      <>
                        <span className="text-slate-600">·</span>
                        <time dateTime={displayUpdatedIso}>
                          更新 {displayUpdatedLabel}
                        </time>
                      </>
                    ) : null}
                  </span>
                  <span className="hidden text-slate-600 sm:mx-2 sm:inline">·</span>
                  <span className="sm:inline">{review.authorName}</span>
                </p>
              </div>
              <ul className="mt-5 flex flex-wrap gap-2">
                {review.tags.map((tag) => (
                  <li
                    key={tag}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold ${isArticle ? "article-tag-pill" : "border-sky-800/35 bg-sky-950/30 text-sky-200/90"}`}
                  >
                    {tag}
                  </li>
                ))}
              </ul>
              {review.affiliateLinks.length > 0 || dlsiteProduct ? (
                <AffiliateDisclosure className="mt-5" />
              ) : null}
              <div
                className={
                  review.affiliateLinks.length > 0
                    ? "mt-5 grid grid-cols-1 gap-4 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-start min-[720px]:gap-6"
                    : "mt-5"
                }
              >
                <div className="min-w-0">
                  <SummaryMarkdown markdown={review.summary} />
                </div>
                {review.affiliateLinks.length > 0 ? (
                  <div className="flex w-full min-w-0 flex-col gap-3 min-[720px]:w-[min(18rem,100%)] min-[720px]:justify-self-end min-[720px]:pt-0.5">
                    {review.affiliateLinks.length === 1 ? (
                      <AffiliateButton
                        link={affiliateLinksHeader(review.affiliateLinks)[0]}
                        className="min-h-11 w-full px-5 py-2.5 text-sm"
                      />
                    ) : (
                      <AffiliateButtonGroup
                        links={affiliateLinksHeader(review.affiliateLinks)}
                        className="w-full"
                      />
                    )}
                  </div>
                ) : null}
              </div>
              {dlsiteProduct ? (
                <div className="mt-5 border-t border-slate-700/30 pt-5">
                  <DlsitePricePanel
                    product={dlsiteProduct}
                    affiliateHref={resolveDlsiteAffiliateHref(review)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {enableTwoModeReview ? (
          <ReviewModeSwitcher
            quickTitle="1分で判断！クイック解析"
            detailTitle={REVIEW_DETAIL_MODE_BUTTON_LABEL}
            quickAffiliateHref={quickAffiliateHref}
            quickDiscountLabel={quickDiscountLabel}
            quickIsOnSale={Boolean(dlsiteSaleDisplay?.on_sale)}
            quickSampleHref={quickSampleHref}
            quickScoreLabel={quickGuideSpec?.scoreLabel ?? `${review.ratingValue}.0 / ${best}`}
            quickDryWetCounts={quickDryWetCounts}
            quickSaleDate={quickSaleDateLabel}
            quickCircleName={quickCircleNameLabel}
            quickOneLine={
              quickGuideSpec?.oneLine ??
              "作品固有の体験を要点だけで把握できるクイック解析です。"
            }
            quickTypeLabel={quickSpecTypeLabel}
            quickInductionType={quickGuideSpec?.inductionType ?? "分析中"}
            quickVoiceActor={quickGuideSpec?.voiceActor ?? ""}
            quickMajorFetish={quickGuideSpec?.majorFetish ?? "分析中"}
            quickKinkType={quickGuideSpec?.kinkType ?? "ノーマル"}
            quickShowRecommendedLevel={!isDoujinReview}
            quickRecommendedLevel={
              quickGuideSpec?.recommendedLevel ?? "初中級（中程度トランス＋暗示受容）"
            }
            quickRecording={quickGuideSpec?.recording ?? "収録時間を確認中"}
            quickRecommendedFor={
              quickGuideSpec?.recommendedFor ?? ["作品ごとの相性要件を整理中です。"]
            }
            quickNotRecommendedFor={
              quickGuideSpec?.notRecommendedFor ?? ["合わない可能性のある条件を整理中です。"]
            }
            quickWorkImpressionParagraphs={quickGuideSpec?.workImpressionParagraphs}
            quickWorkImpressionAvatar={
              quickGuideSpec?.workImpressionParagraphs?.length
                ? review.workImpressionAvatar
                : undefined
            }
            analysisDataMarkdown={analysisDataMarkdown}
          >
            <>
              {!isArticle ? (
                <section className="mt-6 rounded-2xl border border-slate-600/45 bg-slate-800/45 px-5 py-5 shadow-sm shadow-slate-950/20 sm:mt-7 sm:px-6 sm:py-6">
                  {bodyH2Headings.length > 0 ? (
                    <div>
                      <h2 className="mb-3 inline-flex scroll-mt-24 items-center gap-2 rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-lg font-bold tracking-tight text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.18)] sm:text-xl">
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.85)]"
                        />
                        {REVIEW_DETAIL_MODE_BUTTON_LABEL}
                      </h2>
                      <nav aria-label="本文見出し">
                      <p className="rounded-lg border border-slate-600/70 bg-slate-900/65 px-3 py-2.5 text-base font-bold tracking-wide text-slate-100">
                        <span className="mr-2 align-middle text-sm font-extrabold uppercase tracking-[0.22em] text-sky-300">
                          OUTLINE
                        </span>
                        <span className="text-slate-200">読みたい項目からご覧いただけます。</span>
                      </p>
                      <ul className="mt-3 space-y-2">
                        {bodyH2Headings.map((h) => (
                          <li key={h.id}>
                            <a
                              href={`#${h.id}`}
                              className="group inline-flex min-h-10 items-center gap-2 rounded-md px-2 py-1 text-[0.95rem] font-medium text-slate-200 transition hover:bg-slate-900/40 hover:text-sky-200"
                            >
                              <span
                                aria-hidden
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400 transition group-hover:bg-sky-300"
                              />
                              {h.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                      </nav>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section
                className={`mt-8 min-w-0 rounded-3xl border border-slate-600/45 bg-slate-800/50 shadow-md shadow-slate-950/20 backdrop-blur-sm sm:mt-9 sm:px-8 sm:py-9 ${isArticle ? "article-body-shell px-5 py-8 max-sm:py-8" : "px-4 py-7"}`}
              >
                {!review.body ? (
                  <p className="text-slate-500">本文がまだありません。</p>
                ) : finalRatingSplit ? (
                  <>
                    {recommendedAudienceSplit ? (
                      <>
                        {recommendedAudienceSplit.prefix.trim() ? (
                          <ReviewMarkdown
                            markdown={recommendedAudienceSplit.prefix}
                            articleReading={isArticle}
                            starReviewReadingComfort={!isArticle}
                            workImpressionAvatar={review.workImpressionAvatar}
                          />
                        ) : null}
                        <div
                          className={`review-recommended-panel flow-root rounded-2xl border border-sky-500/25 bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-sky-950/25 px-4 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] ring-1 ring-sky-500/10 sm:px-6 sm:py-6 ${
                            recommendedAudienceSplit.prefix.trim()
                              ? "mt-8 sm:mt-9"
                              : ""
                          }`}
                          aria-labelledby="recommended-audience"
                        >
                          <ReviewMarkdown
                            markdown={recommendedAudienceSplit.audience}
                            articleReading={isArticle}
                            starReviewReadingComfort={!isArticle}
                            workImpressionAvatar={review.workImpressionAvatar}
                            recommendedAudienceHeading
                          />
                        </div>
                      </>
                    ) : finalRatingSplit.before.trim() ? (
                      <ReviewMarkdown
                        markdown={finalRatingSplit.before}
                        articleReading={isArticle}
                        starReviewReadingComfort={!isArticle}
                        workImpressionAvatar={review.workImpressionAvatar}
                      />
                    ) : null}
                    <div className="mt-10 border-t border-slate-700/50 pt-8">
                      <div className="grid grid-cols-1 gap-6 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-start min-[720px]:gap-8">
                        <div className="min-w-0">
                          <h2
                            id={finalRatingHeadingId}
                            className="review-h2--analysis-block mb-3 scroll-mt-24 text-xl font-bold tracking-tight text-slate-50"
                          >
                            総合評価
                          </h2>
                          <ReviewMarkdown
                            markdown={ratingParts.core}
                            articleReading={isArticle}
                            starReviewReadingComfort={!isArticle}
                            workImpressionAvatar={review.workImpressionAvatar}
                          />
                        </div>
                        {review.affiliateLinks.length > 0 ? (
                          <div className="w-full min-w-0 min-[720px]:w-[min(20rem,100%)] min-[720px]:justify-self-end min-[720px]:pt-1">
                            <AffiliateButtonGroup
                              links={affiliateLinksBesideRating(review.affiliateLinks)}
                              className="w-full"
                            />
                          </div>
                        ) : null}
                      </div>
                      {ratingParts.workIntro.trim() ? (
                        <div className="mt-6 min-w-0 sm:mt-8">
                          <ReviewMarkdown
                            markdown={ratingParts.workIntro}
                            articleReading={isArticle}
                            starReviewReadingComfort={!isArticle}
                            workImpressionAvatar={review.workImpressionAvatar}
                          />
                        </div>
                      ) : null}
                    </div>
                    {detailRestMarkdown.trim() ? (
                      <div className="mt-10 min-w-0 border-t border-slate-700/50 pt-8">
                        {restWorkSplit && review.affiliateLinks.length > 0 ? (
                          <>
                            <ReviewMarkdown
                              markdown={restWorkSplit.before}
                              articleReading={isArticle}
                              starReviewReadingComfort={!isArticle}
                              workImpressionAvatar={review.workImpressionAvatar}
                            />
                            <div className="mt-8 flex justify-center sm:justify-start">
                              <AffiliateButton
                                link={{
                                  ...review.affiliateLinks[0],
                                  label: "購入はこちら",
                                }}
                                className="w-full min-h-[3.25rem] sm:w-auto sm:min-w-[14rem]"
                              />
                            </div>
                            {restWorkSplit.after.trim() ? (
                              <div className="mt-10 min-w-0">
                                <ReviewMarkdown
                                  markdown={restWorkSplit.after}
                                  articleReading={isArticle}
                                  starReviewReadingComfort={!isArticle}
                                  workImpressionAvatar={review.workImpressionAvatar}
                                />
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <ReviewMarkdown
                              markdown={detailRestMarkdown}
                              articleReading={isArticle}
                              starReviewReadingComfort={!isArticle}
                              workImpressionAvatar={review.workImpressionAvatar}
                            />
                            {review.affiliateLinks.length > 0 ? (
                              <div className="mt-8 flex justify-center sm:justify-start">
                                <AffiliateButton
                                  link={{
                                    ...review.affiliateLinks[0],
                                    label: "購入はこちら",
                                  }}
                                  className="w-full min-h-[3.25rem] sm:w-auto sm:min-w-[14rem]"
                                />
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <ReviewMarkdown
                    markdown={review.body}
                    articleReading={isArticle}
                    starReviewReadingComfort={!isArticle}
                    workImpressionAvatar={review.workImpressionAvatar}
                  />
                )}
              </section>
            </>
          </ReviewModeSwitcher>
        ) : (
          <>
            {bodyH2Headings.length > 0 ? (
              <section className="mt-6 rounded-2xl border border-slate-600/45 bg-slate-800/45 px-5 py-5 shadow-sm shadow-slate-950/20 sm:mt-7 sm:px-6 sm:py-6">
                <nav className="" aria-label="本文見出し">
                  <p className="rounded-lg border border-slate-600/70 bg-slate-900/65 px-3 py-2.5 text-base font-bold tracking-wide text-slate-100">
                    <span className="mr-2 align-middle text-sm font-extrabold uppercase tracking-[0.22em] text-sky-300">
                      OUTLINE
                    </span>
                    <span className="text-slate-200">読みたい項目からご覧いただけます。</span>
                  </p>
                  <ul className="mt-3 space-y-2">
                    {bodyH2Headings.map((h) => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          className="group inline-flex min-h-10 items-center gap-2 rounded-md px-2 py-1 text-[0.95rem] font-medium text-slate-200 transition hover:bg-slate-900/40 hover:text-sky-200"
                        >
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400 transition group-hover:bg-sky-300"
                          />
                          {h.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </section>
            ) : null}

            <section
              className={`mt-8 min-w-0 rounded-3xl border border-slate-600/45 bg-slate-800/50 shadow-md shadow-slate-950/20 backdrop-blur-sm sm:mt-9 sm:px-8 sm:py-9 ${isArticle ? "article-body-shell px-5 py-8 max-sm:py-8" : "px-4 py-7"}`}
            >
          {!review.body ? (
            <p className="text-slate-500">本文がまだありません。</p>
          ) : finalRatingSplit ? (
            <>
              {recommendedAudienceSplit ? (
                <>
                  {recommendedAudienceSplit.prefix.trim() ? (
                    <ReviewMarkdown
                      markdown={recommendedAudienceSplit.prefix}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                    />
                  ) : null}
                  <div
                    className={`review-recommended-panel flow-root rounded-2xl border border-sky-500/25 bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-sky-950/25 px-4 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] ring-1 ring-sky-500/10 sm:px-6 sm:py-6 ${
                      recommendedAudienceSplit.prefix.trim()
                        ? "mt-8 sm:mt-9"
                        : ""
                    }`}
                    aria-labelledby="recommended-audience"
                  >
                    <ReviewMarkdown
                      markdown={recommendedAudienceSplit.audience}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                      recommendedAudienceHeading
                    />
                  </div>
                </>
              ) : finalRatingSplit.before.trim() ? (
                <ReviewMarkdown
                  markdown={finalRatingSplit.before}
                  articleReading={isArticle}
                  starReviewReadingComfort={!isArticle}
                  workImpressionAvatar={review.workImpressionAvatar}
                />
              ) : null}
              <div className="mt-10 border-t border-slate-700/50 pt-8">
                <div className="grid grid-cols-1 gap-6 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-start min-[720px]:gap-8">
                  <div className="min-w-0">
                    <h2
                      id={finalRatingHeadingId}
                      className="review-h2--analysis-block mb-3 scroll-mt-24 text-xl font-bold tracking-tight text-slate-50"
                    >
                      総合評価
                    </h2>
                    <ReviewMarkdown
                      markdown={ratingParts.core}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                    />
                  </div>
                  {review.affiliateLinks.length > 0 ? (
                    <div className="w-full min-w-0 min-[720px]:w-[min(20rem,100%)] min-[720px]:justify-self-end min-[720px]:pt-1">
                      <AffiliateButtonGroup
                        links={affiliateLinksBesideRating(review.affiliateLinks)}
                        className="w-full"
                      />
                    </div>
                  ) : null}
                </div>
                {ratingParts.workIntro.trim() ? (
                  <div className="mt-6 min-w-0 sm:mt-8">
                    <ReviewMarkdown
                      markdown={ratingParts.workIntro}
                      articleReading={isArticle}
                      starReviewReadingComfort={!isArticle}
                      workImpressionAvatar={review.workImpressionAvatar}
                    />
                  </div>
                ) : null}
              </div>
              {detailRestMarkdown.trim() ? (
                <div className="mt-10 min-w-0 border-t border-slate-700/50 pt-8">
                  {restWorkSplit && review.affiliateLinks.length > 0 ? (
                    <>
                      <ReviewMarkdown
                        markdown={restWorkSplit.before}
                        articleReading={isArticle}
                        starReviewReadingComfort={!isArticle}
                        workImpressionAvatar={review.workImpressionAvatar}
                      />
                      <div className="mt-8 flex justify-center sm:justify-start">
                        <AffiliateButton
                          link={{
                            ...review.affiliateLinks[0],
                            label: "購入はこちら",
                          }}
                          className="w-full min-h-[3.25rem] sm:w-auto sm:min-w-[14rem]"
                        />
                      </div>
                      {restWorkSplit.after.trim() ? (
                        <div className="mt-10 min-w-0">
                          <ReviewMarkdown
                            markdown={restWorkSplit.after}
                            articleReading={isArticle}
                            starReviewReadingComfort={!isArticle}
                            workImpressionAvatar={review.workImpressionAvatar}
                          />
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <ReviewMarkdown
                        markdown={detailRestMarkdown}
                        articleReading={isArticle}
                        starReviewReadingComfort={!isArticle}
                        workImpressionAvatar={review.workImpressionAvatar}
                      />
                      {review.affiliateLinks.length > 0 ? (
                        <div className="mt-8 flex justify-center sm:justify-start">
                          <AffiliateButton
                            link={{
                              ...review.affiliateLinks[0],
                              label: "購入はこちら",
                            }}
                            className="w-full min-h-[3.25rem] sm:w-auto sm:min-w-[14rem]"
                          />
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <ReviewMarkdown
              markdown={review.body}
              articleReading={isArticle}
              starReviewReadingComfort={!isArticle}
              workImpressionAvatar={review.workImpressionAvatar}
            />
          )}
        </section>
          </>
        )}

        {relatedReviews.length > 0 ? (
          <section className="mt-10 border-t border-violet-400/40 pt-6 sm:mt-12 sm:pt-7">
            <h2 className="text-xl font-bold tracking-tight text-slate-100">関連作品</h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {relatedReviews.map((item) => {
                const itemCircle = effectiveCircleName(item);
                const titleOne = reviewTitleSingleLine(item.title);
                return (
                  <li key={item.slug}>
                    <Link
                      href={`/reviews/${item.slug}/`}
                      className="group block overflow-hidden rounded-xl border border-slate-600/45 bg-slate-800/50 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-lg hover:shadow-slate-950/30"
                    >
                      <ReviewCover
                        coverImage={item.coverImage}
                        alt={titleOne}
                        slug={item.slug}
                        className="rounded-none"
                      />
                      <div className="px-3 py-2.5">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-100 group-hover:text-sky-200">
                          {titleOne}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {itemCircle ?? "サークル情報なし"}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {nextReview ? <ArticleNextNav next={nextReview} /> : null}

        {review.affiliateLinks.length > 0 &&
          !showAffiliateBesideRating &&
          review.summary.trim() === "" && (
            <section className="mt-8 rounded-3xl border border-slate-600/40 bg-slate-800/40 px-5 py-7 sm:mt-9 sm:px-8 sm:py-8">
              <h2 className="text-lg font-bold text-slate-50">
                作品のページへ
              </h2>
              <AffiliateButtonGroup links={review.affiliateLinks} className="mt-5" />
            </section>
          )}
      </article>
    </>
  );
}
