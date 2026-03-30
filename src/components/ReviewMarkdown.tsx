import ReactMarkdown from "react-markdown";
import { MarkdownSafeImage } from "@/components/MarkdownSafeImage";

type Props = {
  markdown: string;
};

export function ReviewMarkdown({ markdown }: Props) {
  return (
    <div className="review-md">
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
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-100">{children}</strong>
          ),
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
            <blockquote className="mb-5 rounded-r-xl border-l-4 border-sky-500/45 bg-sky-950/20 py-3 pl-4 pr-3 text-slate-400">
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
