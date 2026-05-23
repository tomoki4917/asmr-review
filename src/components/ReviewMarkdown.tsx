import type { ReactNode } from "react";
import { Fragment } from "react";
import BananaSlug from "github-slugger";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { ArticleDlsitePriceEmbed } from "@/components/ArticleDlsitePriceEmbed";
import { MarkdownSafeImage } from "@/components/MarkdownSafeImage";
import {
  partitionStarReviewMarkdown,
  splitMarkdownByH3Sections,
} from "@/lib/split-review-body";

type Props = {
  markdown: string;
  /** 記事（contentKind: article）向け。スマホで字下げ・行間・リスト間隔を読みやすくする */
  articleReading?: boolean;
  /**
   * 星付きレビュー向け。記事と同様、スマホで見出し・段落・引用・リストの余白と行間を広げる。
   * 本文の文言・見出し順は変えない（表示のみ）。親に `review-reading` とセットで使う。
   */
  starReviewReadingComfort?: boolean;
  /** フロントマター `workImpressionAvatar`。「作品感想」見出しの右に丸アイコンを並べる */
  workImpressionAvatar?: string;
  /**
   * 「どんな人におすすめか」ブロック単体表示時。該当 h2 にアンカー用 id と強調クラスを付ける。
   */
  recommendedAudienceHeading?: boolean;
};

/** `**★10／10**` など満点行を検出（総合評価の強調色用） */
function nodeToPlainText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToPlainText).join("");
  if (typeof node === "object" && node !== null && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    if (props?.children != null) return nodeToPlainText(props.children);
  }
  return "";
}

function isTenOutOfTenRating(text: string): boolean {
  const t = text.replace(/\u00a0/g, " ").trim();
  return /^★\s*10\s*[／/]\s*10\s*$/.test(t);
}

/** 「グラフ評価内訳」の `- **トランス度 8** …` / `- **没入度 8** …` 形式を検出（表示を見出し風にする用） */
function isReviewAxisScoresListItem(children: ReactNode): boolean {
  const text = nodeToPlainText(children).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  return /^(トランス度|シナリオ|音響|快楽度|没入度|刺激度|満足度)\s*\d+\b/.test(text);
}

/** 解析結論の体験感度Lv一覧表（3列・Lv1〜5） */
function isExperienceSensitivityLvTable(children: ReactNode): boolean {
  const text = nodeToPlainText(children).replace(/\u00a0/g, " ");
  return (
    /\bLv\b/.test(text) &&
    /区分/.test(text) &&
    /(到達できる状態|できること)/.test(text) &&
    /Lv1/.test(text) &&
    /Lv5/.test(text)
  );
}

/**
 * パート解説のセリフ一行など。長い分析引用と見分けやすくアクセント表示する。
 * （「で始まらないセリフ」や **キャラ：**「…」形式も拾う）
 */
function isAccentQuoteBlockquote(children: ReactNode): boolean {
  const raw = nodeToPlainText(children).replace(/\u00a0/g, " ").trim();
  if (!raw) return false;
  const softBreaks = (raw.match(/\n\n/g) ?? []).length;
  if (softBreaks >= 2) return false;
  if (raw.length > 320) return false;
  if (/^[「『（【―]/.test(raw)) return true;
  if (/^\*\*[^*]+\*\*\s*[：:]\s*[「『]/.test(raw)) return true;
  const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1 && lines[0].length <= 170) return true;
  if (lines.length === 2 && lines.every((l) => l.length <= 150)) return true;
  return false;
}

type BuildOpts = {
  readingComfort: boolean;
  starReviewReadingComfort: boolean;
  articleReading: boolean;
  workImpressionAvatar?: string;
  recommendedAudienceHeading: boolean;
  articleHeadingSlugger: BananaSlug | null;
  listGap: string;
  h2Comfort: string;
  h3Comfort: string;
  pComfort: string;
};

function buildMarkdownComponents(o: BuildOpts): Components {
  const {
    readingComfort,
    starReviewReadingComfort,
    articleReading,
    workImpressionAvatar,
    recommendedAudienceHeading,
    articleHeadingSlugger,
    listGap,
    h2Comfort,
    h3Comfort,
    pComfort,
  } = o;

  return {
    h3: ({ children }) => {
      const label = nodeToPlainText(children).replace(/\u00a0/g, " ").trim();
      const isWorkIntroLabel = label === "作品解説と感想";
      const isRecommendedSensitivity = /【推奨感度Lv[：:]/.test(label);
      const isExperienceSensitivityLvList = label === "体験感度Lv（一覧）";
      const starTrackH3 =
        starReviewReadingComfort && !articleReading && !isWorkIntroLabel && !isRecommendedSensitivity;
      return (
        <h3
          id={isExperienceSensitivityLvList ? "experience-sensitivity-lv-list" : undefined}
          className={
            isRecommendedSensitivity
              ? `review-h3--recommended-sensitivity mb-0 mt-6 scroll-mt-24 text-lg font-bold tracking-tight text-sky-50 sm:text-xl ${h3Comfort}`
              : isExperienceSensitivityLvList
                ? `mb-2 mt-4 scroll-mt-24 text-lg font-semibold tracking-tight text-slate-100 ${h3Comfort}`
              : isWorkIntroLabel
                ? `mb-2 mt-8 scroll-mt-24 text-xl font-semibold tracking-tight text-slate-100 ${h3Comfort} ${starReviewReadingComfort ? "review-h3--work-intro-star" : ""}`
                : starTrackH3
                  ? `review-h3--star-track mb-2.5 mt-8 scroll-mt-24 text-[1.0625rem] font-medium leading-snug tracking-tight text-slate-200/95 sm:text-lg ${h3Comfort}`
                  : `mb-2 mt-8 scroll-mt-24 text-lg font-semibold tracking-tight text-slate-100 ${h3Comfort}`
          }
        >
          {children}
        </h3>
      );
    },
    h2: ({ children }) => {
      const label = nodeToPlainText(children).replace(/\u00a0/g, " ").trim();
      const isRecommendedAudience =
        recommendedAudienceHeading && label === "どんな人におすすめか";
      const isWorkImpression = label === "作品感想";
      const isWorkOverview = label === "作品像" || label === "作品概要";
      const isPartBreakdown = label === "パート解説" || label === "パート別解析";
      const isInductionAnalysis =
        label === "本作の誘導・暗示解析" || label === "本作の誘導・暗示解析詳細";
      const isReviewGraph = label === "作品評価グラフ";
      const isOverallEvaluation = label === "総合評価";
      const isSummarySection =
        label === "まとめ" || label === "解析まとめ" || label === "解析結論";
      const isStructuralConclusion = label === "総評：本作品の構造的結論";
      const articleH2Accent =
        articleReading &&
        !isRecommendedAudience &&
        !isWorkOverview &&
        !isPartBreakdown &&
        !isWorkImpression;
      const articleHeadingId = isRecommendedAudience
        ? "recommended-audience"
        : articleHeadingSlugger && label
          ? articleHeadingSlugger.slug(label)
          : undefined;
      if (isWorkImpression && workImpressionAvatar) {
        return (
          <div className="review-work-impression-head mb-3 mt-10 flex w-full min-w-0 scroll-mt-24 flex-wrap items-center gap-x-2.5 gap-y-2 first:mt-0 sm:gap-x-3">
            <h2
              id={articleHeadingId}
              className={`mb-0 mt-0 w-auto max-w-full shrink-0 text-xl font-bold leading-tight tracking-tight text-slate-50 ${h2Comfort}`}
            >
              {children}
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element -- レビュー同梱の相対パス／任意 URL */}
            <img
              src={workImpressionAvatar}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full border-2 border-slate-500/55 bg-slate-800/80 object-cover shadow-[0_1px_8px_rgba(0,0,0,0.4)] sm:h-[2.5rem] sm:w-[2.5rem]"
              loading="lazy"
              decoding="async"
            />
          </div>
        );
      }
      return (
        <h2
          id={articleHeadingId}
          className={`mb-3 scroll-mt-24 text-xl font-bold tracking-tight text-slate-50 ${
            isRecommendedAudience ? "mt-0" : "mt-10 first:mt-0"
          } ${h2Comfort} ${articleH2Accent ? "article-md-h2 article-md-h2--accent" : ""} ${isWorkImpression ? "review-h2--work-impression" : ""} ${
            isRecommendedAudience ? "review-h2--recommended-audience" : ""
          } ${isWorkOverview ? "review-h2--work-overview" : ""} ${
            isPartBreakdown ? "review-h2--part-breakdown" : ""
          } ${isInductionAnalysis || isReviewGraph || isOverallEvaluation || isWorkOverview || isPartBreakdown || isSummarySection || isStructuralConclusion ? "review-h2--analysis-block" : ""}`}
        >
          {children}
        </h2>
      );
    },
    p: ({ children }) => {
      const plain = nodeToPlainText(children).replace(/\u00a0/g, " ").trim();
      const pullSummary =
        starReviewReadingComfort && /^一言で言えば[:：\uFF1A]/.test(plain);
      const audienceSubhead =
        plain === "おすすめしたい方"
          ? "recommended"
          : plain === "合わない可能性がある方" || plain === "合わない人"
            ? "not-recommended"
            : null;
      return (
        <p
          className={`review-md-p mb-5 leading-[1.75] last:mb-0 ${pComfort} ${articleReading ? "text-slate-200/95" : "text-slate-300"} ${pullSummary ? "review-md-p--pull-summary" : ""} ${audienceSubhead ? `review-audience-subhead review-audience-subhead--${audienceSubhead}` : ""}`}
        >
          {children}
        </p>
      );
    },
    ul: ({ children, node }) => {
      const classNames = node?.properties?.className;
      const isRecommendedSensitivityList = Array.isArray(classNames)
        ? classNames.includes("review-recommended-sensitivity-panel__list")
        : false;
      if (isRecommendedSensitivityList) {
        return (
          <ul className="review-recommended-sensitivity-panel__list m-0 list-none p-0">
            {children}
          </ul>
        );
      }
      return (
        <ul
          className={`mb-4 list-disc pl-5 ${listGap} ${articleReading ? "article-md-list text-slate-200/92" : "text-slate-300"}`}
        >
          {children}
        </ul>
      );
    },
    ol: ({ children }) => (
      <ol
        className={`mb-4 list-decimal pl-5 ${listGap} ${articleReading ? "article-md-list text-slate-200/92" : "text-slate-300"}`}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => {
      const axisLi = isReviewAxisScoresListItem(children);
      return (
        <li
          className={`${
            readingComfort ? "leading-relaxed max-sm:leading-[1.68]" : "leading-relaxed"
          } ${axisLi ? "review-md-axis-li" : ""}`}
        >
          {children}
        </li>
      );
    },
    strong: ({ children }) => {
      const plain = nodeToPlainText(children);
      const perfect = isTenOutOfTenRating(plain);
      return (
        <strong
          className={
            perfect
              ? "font-semibold text-red-400 drop-shadow-[0_0_14px_rgba(248,113,113,0.4)]"
              : starReviewReadingComfort
                ? "font-semibold text-slate-200/95"
                : "font-semibold text-slate-100"
          }
        >
          {children}
        </strong>
      );
    },
    em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
    mark: ({ children }) => (
      <mark className={starReviewReadingComfort ? "review-md-mark" : undefined}>{children}</mark>
    ),
    abbr: ({ title, children }) => (
      <abbr
        title={typeof title === "string" ? title : undefined}
        className={starReviewReadingComfort ? "review-md-abbr" : undefined}
      >
        {children}
      </abbr>
    ),
    a: ({ href, children }) => {
      const h = typeof href === "string" ? href.trim() : "";
      const isFragment = h.startsWith("#") && h.length > 1 && !h.includes(":");
      const ok =
        isFragment ||
        h.startsWith("https://") ||
        h.startsWith("http://") ||
        h.startsWith("/");
      if (!ok) return <span>{children}</span>;
      const className =
        "font-medium text-sky-300 underline decoration-sky-500/40 underline-offset-[3px] transition hover:text-sky-200 hover:decoration-sky-400/60";
      if (isFragment) {
        return (
          <a href={h} className={`${className}${articleReading ? " article-md-anchor" : ""}`}>
            {children}
          </a>
        );
      }
      return (
        <a href={h} className={className} rel="noopener noreferrer" target="_blank">
          {children}
        </a>
      );
    },
    img: ({ src, alt }) => (
      <MarkdownSafeImage src={src} alt={alt ?? ""} variant="body" />
    ),
    blockquote: ({ children }) => {
      const accentQuote =
        starReviewReadingComfort && !articleReading && isAccentQuoteBlockquote(children);
      return (
        <blockquote
          className={`review-md-bq relative my-6 rounded-xl border py-4 pl-5 pr-4 leading-[1.8] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] [&_p]:mb-3 [&_p:last-child]:mb-0 ${
            articleReading
              ? "article-md-bq border border-teal-500/25 border-l-[3px] border-l-teal-400/55 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-teal-950/20 text-slate-300/95 ring-1 ring-teal-500/15"
              : "border-slate-600/40 border-l-4 border-l-sky-500/50 bg-slate-800/95 text-slate-400 ring-1 ring-slate-700/45"
          } ${readingComfort ? "max-sm:my-5 max-sm:pl-4 max-sm:pr-3 max-sm:py-[0.95rem]" : ""} ${accentQuote ? "review-md-bq--accent-quote" : ""}`}
        >
          {children}
        </blockquote>
      );
    },
    hr: () => (
      <hr
        className={
          articleReading
            ? "article-md-hr my-10 max-sm:my-9"
            : readingComfort
              ? "my-8 border-slate-700/60 max-sm:my-8"
              : "my-8 border-slate-700/60"
        }
      />
    ),
    table: ({ children }) => {
      const sensitivityLvTable = isExperienceSensitivityLvTable(children);
      return (
        <div
          className={`review-md-table-wrap my-6 overflow-x-auto rounded-xl border ring-1 ${
            articleReading
              ? "article-md-table-wrap border-sky-500/20 bg-slate-950/40 ring-sky-500/10"
              : "border-slate-600/40 bg-slate-900/35 ring-slate-700/35"
          } ${readingComfort ? "max-sm:my-5" : ""} ${sensitivityLvTable ? "review-sensitivity-lv-table" : ""}`}
        >
          <table className="w-full min-w-[16rem] border-collapse text-left text-sm text-slate-300">
            {children}
          </table>
        </div>
      );
    },
    thead: ({ children }) => (
      <thead
        className={`border-b ${articleReading ? "border-sky-500/20 bg-sky-500/[0.09]" : "border-slate-600/50 bg-slate-800/55"}`}
      >
        {children}
      </thead>
    ),
    tbody: ({ children }) => <tbody className="divide-y divide-slate-700/45">{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th
        scope="col"
        className={`whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-slate-100 sm:px-4 sm:py-3 ${
          readingComfort ? "max-sm:py-3" : ""
        }`}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        className={`px-3 py-2.5 align-top sm:px-4 sm:py-3 ${
          readingComfort ? "max-sm:py-3 max-sm:leading-relaxed" : ""
        }`}
      >
        {children}
      </td>
    ),
    div: ({ children, className, ...rest }) => {
      if (!articleReading) {
        return (
          <div className={className} {...rest}>
            {children}
          </div>
        );
      }
      const props = rest as Record<string, unknown>;
      const productId =
        props["data-dlsite-product-id"] ?? props.dataDlsiteProductId;
      const affiliateHref =
        props["data-dlsite-affiliate-href"] ?? props.dataDlsiteAffiliateHref;
      if (typeof productId === "string" && productId.trim()) {
        return (
          <ArticleDlsitePriceEmbed
            productId={productId}
            affiliateHref={
              typeof affiliateHref === "string" ? affiliateHref : undefined
            }
          />
        );
      }
      return (
        <div className={className} {...rest}>
          {children}
        </div>
      );
    },
  };
}

const remarkPlugins = [remarkGfm];

export function ReviewMarkdown({
  markdown,
  articleReading = false,
  starReviewReadingComfort = false,
  workImpressionAvatar,
  recommendedAudienceHeading = false,
}: Props) {
  const readingComfort = articleReading || starReviewReadingComfort;
  const listGap =
    starReviewReadingComfort && readingComfort
      ? "space-y-2.5 sm:space-y-1.5"
      : readingComfort
        ? "space-y-2 sm:space-y-1"
        : "space-y-1";
  const h2Comfort = readingComfort
    ? "max-sm:text-[1.1875rem] max-sm:leading-snug"
    : "";
  const h3Comfort = readingComfort ? "max-sm:text-[1rem]" : "";
  const pComfort =
    readingComfort && starReviewReadingComfort
      ? "max-sm:mb-6 max-sm:leading-[1.74]"
      : readingComfort
        ? "max-sm:mb-5 max-sm:leading-[1.74]"
        : "";

  const articleHeadingSlugger = new BananaSlug();

  const normalizedMd = markdown.replace(/\r\n/g, "\n");
  const segments = starReviewReadingComfort
    ? partitionStarReviewMarkdown(normalizedMd)
    : [{ kind: "markdown" as const, source: normalizedMd }];

  const components = buildMarkdownComponents({
    readingComfort,
    starReviewReadingComfort,
    articleReading,
    workImpressionAvatar,
    recommendedAudienceHeading,
    articleHeadingSlugger,
    listGap,
    h2Comfort,
    h3Comfort,
    pComfort,
  });

  const rehypePlugins =
    starReviewReadingComfort || articleReading ? [rehypeRaw] : [];

  return (
    <div
      className={`review-md flow-root min-w-0 max-w-full ${readingComfort ? "review-md--article" : ""} ${articleReading ? "article-md-prose" : ""} ${starReviewReadingComfort ? "review-md--star-review" : ""}`}
    >
      {segments.map((seg, idx) => {
        if (seg.kind === "markdown") {
          if (!seg.source.trim()) return null;
          return (
            <ReactMarkdown
              key={idx}
              remarkPlugins={remarkPlugins}
              {...(rehypePlugins.length > 0 ? { rehypePlugins } : {})}
              components={components}
            >
              {seg.source}
            </ReactMarkdown>
          );
        }
        if (seg.kind === "workSummaryPanel") {
          const stripChunks = splitMarkdownByH3Sections(seg.bodyMarkdown);
          return (
            <Fragment key={idx}>
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                {...(rehypePlugins.length > 0 ? { rehypePlugins } : {})}
                components={components}
              >
                {seg.headingMarkdown}
              </ReactMarkdown>
              {stripChunks.length > 0 ? (
                <div
                  className="review-work-summary-strip mb-6 mt-1 min-w-0 sm:mb-7"
                  role="region"
                  aria-label="作品概要の内訳（横にスクロール）"
                >
                  <div className="review-work-summary-strip__track touch-pan-x">
                    {stripChunks.map((chunk, j) => (
                      <div key={j} className="review-work-summary-card">
                        <ReactMarkdown
                          remarkPlugins={remarkPlugins}
                          {...(rehypePlugins.length > 0 ? { rehypePlugins } : {})}
                          components={components}
                        >
                          {chunk}
                        </ReactMarkdown>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Fragment>
          );
        }
        const body = seg.bodyMarkdown;
        return (
          <Fragment key={idx}>
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              {...(rehypePlugins.length > 0 ? { rehypePlugins } : {})}
              components={components}
            >
              {seg.headingMarkdown}
            </ReactMarkdown>
            <div
              className={`review-work-impression-panel${body.trim() ? "" : " review-work-impression-panel--empty"}`}
            >
              {body.trim() ? (
                <ReactMarkdown
                  remarkPlugins={remarkPlugins}
                  {...(rehypePlugins.length > 0 ? { rehypePlugins } : {})}
                  components={components}
                >
                  {body}
                </ReactMarkdown>
              ) : null}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
