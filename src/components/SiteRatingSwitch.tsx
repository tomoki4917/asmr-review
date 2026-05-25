"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ALL_AGES_SITE_BASE,
  getAllAgesSiteUrl,
  getR18SiteUrl,
  isExternalSiteUrl,
} from "@/lib/site-rating-switch";

type SiteRatingSwitchProps = {
  compact?: boolean;
  fullWidth?: boolean;
  className?: string;
};

function segmentClass(active: boolean, compact: boolean, fullWidth: boolean) {
  const pad = compact
    ? "px-2.5 py-1 text-[10px]"
    : "px-2.5 py-1.5 text-[11px] sm:px-3 sm:py-2 sm:text-xs";
  const width = fullWidth ? " flex-1 text-center" : "";
  if (active) {
    return `${pad}${width} font-semibold text-slate-50 bg-sky-600/90 shadow-inner ring-1 ring-sky-400/35`;
  }
  return `${pad}${width} font-medium text-slate-300 transition hover:bg-slate-700/70 hover:text-sky-100`;
}

function RatingSegment({
  active,
  href,
  label,
  compact,
  fullWidth,
}: {
  active: boolean;
  href: string;
  label: string;
  compact: boolean;
  fullWidth: boolean;
}) {
  const className = segmentClass(active, compact, fullWidth);

  if (active) {
    return (
      <span className={className} aria-current="page">
        {label}
      </span>
    );
  }

  if (isExternalSiteUrl(href)) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

/** ヘッダー用：全年齢向け ⇄ 成人向け【R18】 */
export function SiteRatingSwitch({
  compact = false,
  fullWidth = false,
  className = "",
}: SiteRatingSwitchProps) {
  const pathname = usePathname() ?? "/";
  const isAllAges = pathname.startsWith(ALL_AGES_SITE_BASE);

  return (
    <div
      role="group"
      aria-label="サイト区分の切り替え"
      className={`${fullWidth ? "flex w-full" : "inline-flex"} max-w-full shrink-0 overflow-hidden rounded-full border border-slate-500/55 bg-slate-800/75 p-0.5 shadow-sm ring-1 ring-white/5 ${className}`}
    >
      <RatingSegment
        active={isAllAges}
        href={getAllAgesSiteUrl()}
        label="全年齢向け"
        compact={compact}
        fullWidth={fullWidth}
      />
      <RatingSegment
        active={!isAllAges}
        href={getR18SiteUrl()}
        label="成人向け【R18】"
        compact={compact}
        fullWidth={fullWidth}
      />
    </div>
  );
}
