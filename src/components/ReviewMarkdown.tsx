import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { MarkdownSafeImage } from "@/components/MarkdownSafeImage";

type Props = {
  markdown: string;
  /** 記事（contentKind: article）向け。スマホで字下げ・行間・リスト間隔を読みやすくする */
  articleReading?: boolean;
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

export function ReviewMarkdown({ markdown, articleReading = false }: Props) {
  const listGap = articleReading ? "space-y-2 sm:space-y-1" : "space-y-1";
  const h2Article = articleReading
    ? "max-sm:text-[1.3125rem] max-sm:leading-snug"
    : "";
  const h3Article = articleReading ? "max-sm:text-[1.08rem]" : "";
  const pArticle = articleReading
    ? "max-sm:mb-6 max-sm:leading-[1.88]"
    : "";

  return (
    <div
      className={`review-md min-w-0 max-w-full ${articleReading ? "review-md--article" : ""}`}
    >
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2
              className={`mb-3 mt-10 scroll-mt-24 text-xl font-bold tracking-tight text-slate-50 first:mt-0 ${h2Article}`}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => {
            const label = nodeToPlainText(children).replace(/\u00a0/g, " ").trim();
            const isWorkIntroLabel = label === "作品解説と感想";
            return (
              <h3
                className={
                  isWorkIntroLabel
                    ? `mb-2 mt-8 scroll-mt-24 text-xl font-semibold tracking-tight text-slate-100 ${h3Article}`
                    : `mb-2 mt-8 scroll-mt-24 text-lg font-semibold tracking-tight text-slate-100 ${h3Article}`
                }
              >
                {children}
              </h3>
            );
          },
          p: ({ children }) => (
            <p
              className={`review-md-p mb-5 leading-[1.75] text-slate-300 last:mb-0 ${pArticle}`}
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
          li: ({ children }) => (
            <li
              className={
                articleReading ? "leading-relaxed max-sm:leading-[1.75]" : "leading-relaxed"
              }
            >
              {children}
            </li>
          ),
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
              className={`review-md-bq relative my-6 rounded-xl border border-slate-600/40 border-l-4 border-l-sky-500/50 bg-slate-800/95 py-4 pl-5 pr-4 leading-[1.8] text-slate-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ring-1 ring-slate-700/45 [&_p]:mb-3 [&_p:last-child]:mb-0 ${articleReading ? "max-sm:my-5 max-sm:pl-4 max-sm:pr-3 max-sm:py-[0.95rem]" : ""}`}
            >
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr
              className={
                articleReading
                  ? "my-8 border-slate-700/60 max-sm:my-9"
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
