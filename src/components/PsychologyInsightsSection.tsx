import Link from "next/link";
import type { Review } from "@/lib/types";
import { stripMarkdownForMeta } from "@/lib/strip-markdown-lite";
import { ReviewCover } from "./ReviewCover";

const GUIDE_META: Record<
  string,
  { step: string; shortTitle: string; accent: string }
> = {
  "hypnosis-mechanism-01": {
    step: "STEP 1",
    shortTitle: "催眠音声とは",
    accent: "from-emerald-500/25 to-sky-500/10",
  },
  "nou-iki-toha": {
    step: "STEP 2",
    shortTitle: "脳イキとは",
    accent: "from-violet-500/25 to-sky-500/10",
  },
  "dry-orgasm-what-is": {
    step: "STEP 3",
    shortTitle: "ドライオーガズムとは",
    accent: "from-amber-500/20 to-rose-500/10",
  },
};

type Props = {
  beginnerGuides: Review[];
};

export function PsychologyInsightsSection({ beginnerGuides }: Props) {
  return (
    <section
      id="hypnosis-intro"
      aria-labelledby="hypnosis-intro-heading"
      className="mx-auto mt-16 max-w-5xl scroll-mt-28 max-sm:-mx-4 max-sm:px-2 sm:mx-auto"
    >
      <div className="rounded-2xl border border-slate-600/45 bg-slate-800/45 px-2 py-4 shadow-lg shadow-slate-950/20 backdrop-blur-md sm:rounded-3xl sm:px-6 sm:py-8 md:p-10">
        <h2
          id="hypnosis-intro-heading"
          className="text-center text-lg font-bold tracking-tight text-sky-200 sm:text-xl md:text-2xl"
        >
          催眠音声入門
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] leading-relaxed text-slate-400 sm:mt-3 sm:text-sm">
          入門 → 脳イキ → ドライの順でつながる{" "}
          <strong className="font-medium text-slate-300">3 本立て</strong>
          です。気になるタイトルから読み始めても OK です。
        </p>

        {beginnerGuides.length > 0 ? (
          <ul
            id="beginner-guide-cards"
            className="mt-5 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-3 md:mt-10 md:gap-5"
          >
            {beginnerGuides.map((review, i) => {
              const meta = GUIDE_META[review.slug] ?? {
                step: `STEP ${i + 1}`,
                shortTitle: review.title,
                accent: "from-slate-600/30 to-slate-800/20",
              };
              const teaser = stripMarkdownForMeta(review.summary);
              const plain =
                teaser.length > 140 ? `${teaser.slice(0, 137)}…` : teaser;

              return (
                <li key={review.slug} className="min-w-0">
                  <article
                    className={`group flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-600/45 bg-gradient-to-b ${meta.accent} shadow-md shadow-slate-950/25 ring-1 ring-slate-700/25 transition hover:-translate-y-0.5 hover:border-sky-500/40 hover:ring-sky-500/20 sm:rounded-2xl`}
                  >
                    <Link
                      href={`/reviews/${review.slug}/`}
                      className="flex min-h-0 min-w-0 flex-1 flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/50"
                    >
                      <div className="flex w-full min-w-0 shrink-0 items-center justify-center overflow-hidden border-b border-slate-600/35 bg-slate-900">
                        <ReviewCover
                          coverImage={review.coverImage}
                          alt={review.title}
                          slug={review.slug}
                          priority={i < 2}
                          className="!aspect-[16/10] w-full rounded-none"
                          imageClassName="h-full w-full object-cover object-center"
                        />
                      </div>
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-3 pt-2 sm:px-2 sm:pb-3 sm:pt-1.5 md:px-5 md:pb-6 md:pt-3">
                        <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-300/90 sm:text-[10px] sm:tracking-[0.18em] md:text-[11px] md:tracking-[0.2em]">
                          {meta.step}
                        </p>
                        <h3 className="mt-0.5 text-[11px] font-bold leading-tight tracking-tight text-slate-50 group-hover:text-sky-100 sm:mt-1 sm:text-sm md:text-lg md:leading-snug">
                          {meta.shortTitle}
                        </h3>
                        <p className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-tight text-slate-500 sm:text-[11px] sm:leading-snug md:text-xs">
                          {review.title}
                        </p>
                        <p className="mt-1.5 line-clamp-2 flex-1 text-[9px] leading-snug text-slate-400 sm:mt-2 sm:line-clamp-3 sm:text-xs sm:leading-relaxed md:mt-3 md:text-sm">
                          {plain}
                        </p>
                        <p className="mt-2 text-[9px] font-semibold leading-tight text-sky-300 transition group-hover:text-sky-200 sm:mt-3 sm:text-xs sm:leading-none md:mt-4 md:text-sm">
                          記事を読む
                          <span aria-hidden className="ml-0.5 inline-block transition group-hover:translate-x-0.5 sm:ml-1">
                            →
                          </span>
                        </p>
                      </div>
                    </Link>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
