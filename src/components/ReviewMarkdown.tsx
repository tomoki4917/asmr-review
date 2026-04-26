import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { MarkdownSafeImage } from "@/components/MarkdownSafeImage";

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

/** 「グラフ評価内訳」の `- **トランス度 8** …` 形式を検出（表示を見出し風にする用） */
function isReviewAxisScoresListItem(children: ReactNode): boolean {
  const text = nodeToPlainText(children).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  return /^(トランス度|快楽度|満足度)\s*\d+\b/.test(text);
}

export function ReviewMarkdown({
  markdown,
  articleReading = false,
  starReviewReadingComfort = false,
  workImpressionAvatar,
  recommendedAudienceHeading = false,
}: Props) {
  const readingComfort = articleReading || starReviewReadingComfort;
  const listGap = readingComfort ? "space-y-2 sm:space-y-1" : "space-y-1";
  const h2Comfort = readingComfort
    ? "max-sm:text-[1.1875rem] max-sm:leading-snug"
    : "";
  const h3Comfort = readingComfort ? "max-sm:text-[1rem]" : "";
  const pComfort = readingComfort ? "max-sm:mb-5 max-sm:leading-[1.74]" : "";

  return (
    <div
      className={`review-md flow-root min-w-0 max-w-full ${readingComfort ? "review-md--article" : ""}`}
    >
      <ReactMarkdown
        components={{
          h3: ({ children }) => {
            const label = nodeToPlainText(children).replace(/\u00a0/g, " ").trim();
            const isWorkIntroLabel = label === "作品解説と感想";
            return (
              <h3
                className={
                  isWorkIntroLabel
                    ? `mb-2 mt-8 scroll-mt-24 text-xl font-semibold tracking-tight text-slate-100 ${h3Comfort}`
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
            if (isWorkImpression && workImpressionAvatar) {
              return (
                <div className="review-work-impression-head mb-3 mt-10 flex w-full min-w-0 scroll-mt-24 flex-wrap items-center gap-x-2.5 gap-y-2 first:mt-0 sm:gap-x-3">
                  <h2
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
                id={isRecommendedAudience ? "recommended-audience" : undefined}
                className={`mb-3 scroll-mt-24 text-xl font-bold tracking-tight text-slate-50 ${
                  isRecommendedAudience ? "mt-0" : "mt-10 first:mt-0"
                } ${h2Comfort} ${isWorkImpression ? "review-h2--work-impression" : ""} ${
                  isRecommendedAudience ? "review-h2--recommended-audience" : ""
                }`}
              >
                {children}
              </h2>
            );
          },
          p: ({ children }) => (
            <p
              className={`review-md-p mb-5 leading-[1.75] text-slate-300 last:mb-0 ${pComfort}`}
            >
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className={`mb-4 list-disc pl-5 text-slate-300 ${listGap}`}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={`mb-4 list-decimal pl-5 text-slate-300 ${listGap}`}>
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
                    : "font-semibold text-slate-100"
                }
              >
                {children}
              </strong>
            );
          },
          em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
          a: ({ href, children }) => {
            const h = typeof href === "string" ? href.trim() : "";
            const ok =
              h.startsWith("https://") ||
              h.startsWith("http://") ||
              h.startsWith("/");
            if (!ok) return <span>{children}</span>;
            return (
              <a
                href={h}
                className="font-medium text-sky-300 underline decoration-sky-500/40 underline-offset-[3px] transition hover:text-sky-200 hover:decoration-sky-400/60"
                rel="noopener noreferrer"
                target="_blank"
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => (
            <MarkdownSafeImage src={src} alt={alt ?? ""} variant="body" />
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={`review-md-bq relative my-6 rounded-xl border border-slate-600/40 border-l-4 border-l-sky-500/50 bg-slate-800/95 py-4 pl-5 pr-4 leading-[1.8] text-slate-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ring-1 ring-slate-700/45 [&_p]:mb-3 [&_p:last-child]:mb-0 ${readingComfort ? "max-sm:my-5 max-sm:pl-4 max-sm:pr-3 max-sm:py-[0.95rem]" : ""}`}
            >
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr
              className={
                readingComfort
                  ? "my-8 border-slate-700/60 max-sm:my-8"
                  : "my-8 border-slate-700/60"
              }
            />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
