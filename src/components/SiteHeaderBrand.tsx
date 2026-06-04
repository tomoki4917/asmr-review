"use client";

import Link from "next/link";
import { DEFAULT_WORK_IMPRESSION_AVATAR_SRC } from "@/lib/default-work-impression-avatar";
import { SITE_X_URL } from "@/lib/site-brand";
import { useSiteBrand } from "@/lib/use-site-brand";

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function SiteHeaderBrand() {
  const { siteName, homeHref } = useSiteBrand();

  return (
    <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
      <Link
        href={homeHref}
        className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg py-2 pl-0 pr-1 text-left transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/50 sm:gap-3 sm:pr-2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 作品感想アイコンと同一の同梱アセット */}
        <img
          src={DEFAULT_WORK_IMPRESSION_AVATAR_SRC}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full border-2 border-slate-500/55 bg-slate-800/80 object-cover shadow-[0_1px_8px_rgba(0,0,0,0.4)] sm:h-[2.5rem] sm:w-[2.5rem]"
          width={40}
          height={40}
          loading="eager"
          decoding="async"
        />
        <span className="min-w-0">
          <span className="block text-xs font-medium uppercase tracking-[0.22em] text-sky-400/90">
            personal blog
          </span>
          <span className="block truncate text-base font-bold tracking-tight text-slate-50 sm:text-lg">
            {siteName}
          </span>
        </span>
      </Link>
      <a
        href={SITE_X_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="X（@aimer010855）"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400/50 sm:h-10 sm:w-10"
      >
        <XIcon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" />
      </a>
    </div>
  );
}
