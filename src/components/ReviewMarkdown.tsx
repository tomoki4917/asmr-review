import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { MarkdownSafeImage } from "@/components/MarkdownSafeImage";

type Props = {
  markdown: string;
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

export function ReviewMarkdown({ markdown }: Props) {
  return (
    <div className="review-md min-w-0 max-w-full">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mb-3 mt-10 scroll-mt-24 text-xl font-bold tracking-tight text-slate-50 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-8 scroll-mt-24 text-lg font-semibold tracking-tight text-slate-100">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-5 text-[1.05rem] leading-[1.75] text-slate-300 last:mb-0">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-1 pl-5 text-slate-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-1 pl-5 text-slate-300">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
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
            <blockquote className="relative my-6 rounded-xl border border-slate-600/40 border-l-4 border-l-sky-500/50 bg-slate-800/95 py-4 pl-5 pr-4 text-[1.05rem] leading-[1.8] text-slate-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ring-1 ring-slate-700/45 [&_p]:mb-3 [&_p:last-child]:mb-0">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-slate-700/60" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
