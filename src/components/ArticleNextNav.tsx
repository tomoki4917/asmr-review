import Link from "next/link";
import type { Review } from "@/lib/types";

type Props = {
  next: Review;
};

export function ArticleNextNav({ next }: Props) {
  return (
    <nav
      className="mt-8 rounded-2xl border border-sky-800/40 bg-gradient-to-br from-sky-950/40 to-slate-900/60 px-5 py-6 shadow-md shadow-slate-950/25 sm:mt-9 sm:px-6 sm:py-6"
      aria-label="次の記事"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/90">
        次の記事
      </p>
      <Link
        href={`/reviews/${next.slug}/`}
        className="group mt-2 block min-h-[2.75rem] text-base font-semibold leading-snug text-slate-50 transition hover:text-sky-200 sm:min-h-0 sm:text-lg"
      >
        {next.title}
        <span
          aria-hidden
          className="ml-1 inline-block text-sky-400 transition group-hover:translate-x-0.5"
        >
          →
        </span>
      </Link>
    </nav>
  );
}
