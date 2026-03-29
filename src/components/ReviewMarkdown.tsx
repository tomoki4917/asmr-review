import ReactMarkdown from "react-markdown";

type Props = {
  markdown: string;
};

export function ReviewMarkdown({ markdown }: Props) {
  return (
    <div className="review-md">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mb-3 mt-10 scroll-mt-24 text-xl font-bold tracking-tight text-stone-900 first:mt-0 dark:text-stone-50">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-8 scroll-mt-24 text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-50">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-5 text-[1.05rem] leading-[1.75] text-stone-800 last:mb-0 dark:text-stone-200">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-1 pl-5 text-stone-800 dark:text-stone-200">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-1 pl-5 text-stone-800 dark:text-stone-200">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-stone-900 dark:text-stone-100">
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-indigo-700 underline decoration-indigo-300/70 underline-offset-[3px] transition hover:text-indigo-900 hover:decoration-indigo-500 dark:text-indigo-400 dark:decoration-indigo-500/40 dark:hover:text-indigo-300"
              rel="noopener noreferrer"
              target="_blank"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-5 rounded-r-xl border-l-4 border-indigo-400 bg-indigo-50/60 py-3 pl-4 pr-3 text-stone-700 dark:border-indigo-500 dark:bg-indigo-950/25 dark:text-stone-300">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-stone-200 dark:border-stone-700" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
