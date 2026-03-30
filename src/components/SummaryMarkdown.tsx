import ReactMarkdown from "react-markdown";
import { MarkdownSafeImage } from "@/components/MarkdownSafeImage";

type Props = {
  markdown: string;
  className?: string;
};

export function SummaryMarkdown({ markdown, className = "" }: Props) {
  if (!markdown.trim()) return null;

  return (
    <div className={`summary-md text-pretty text-base leading-relaxed text-slate-400 ${className}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-4 last:mb-0 [&+p]:mt-4">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-200">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
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
            <MarkdownSafeImage src={src} alt={alt ?? ""} variant="summary" />
          ),
          br: () => <br />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
