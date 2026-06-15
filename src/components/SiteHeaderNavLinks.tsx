"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAllAgesPath } from "@/lib/site-brand";
import { buildReviewListHref } from "@/lib/review-list-href";
import { ALL_AGES_SITE_BASE, R18_SITE_BASE } from "@/lib/site-rating-switch";

export function SiteHeaderNavLinks() {
  const pathname = usePathname() ?? "/";
  const listBase = isAllAgesPath(pathname)
    ? pathname === "/"
      ? "/"
      : ALL_AGES_SITE_BASE
    : R18_SITE_BASE;
  const listHref = buildReviewListHref(listBase);

  return (
    <nav
      className="flex shrink-0 items-center gap-2.5 sm:gap-3.5"
      aria-label="主要ナビゲーション"
    >
      <Link
        href={listHref}
        className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-500/65 bg-slate-800/65 px-4 py-2 text-sm font-medium leading-none text-slate-100 shadow-sm ring-1 ring-white/5 transition hover:border-sky-500/45 hover:bg-slate-700/75 sm:min-h-[3.25rem] sm:px-5 sm:py-2.5 sm:text-[0.9375rem]"
      >
        一覧
      </Link>
      <Link
        href="/contact/"
        className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-500/65 bg-slate-800/65 px-4 py-2 text-sm font-medium leading-none text-slate-100 shadow-sm ring-1 ring-white/5 transition hover:border-sky-500/45 hover:bg-slate-700/75 sm:min-h-[3.25rem] sm:px-5 sm:py-2.5 sm:text-[0.9375rem]"
      >
        お問い合わせ
      </Link>
    </nav>
  );
}
