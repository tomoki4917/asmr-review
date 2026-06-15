"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AgeVerificationGate } from "@/components/AgeGate";
import { isAgeVerified } from "@/lib/age-verification";
import { isAllAgesPath, isYouTubeWelcomePath } from "@/lib/site-brand";
import {
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

function AllAgesSegment({
  active,
  compact,
  fullWidth,
}: {
  active: boolean;
  compact: boolean;
  fullWidth: boolean;
}) {
  const className = segmentClass(active, compact, fullWidth);
  const href = getAllAgesSiteUrl();

  if (active) {
    return (
      <span className={className} aria-current="page">
        全年齢向け
      </span>
    );
  }

  return (
    <Link href={href} className={className}>
      全年齢向け
    </Link>
  );
}

function R18Segment({
  active,
  compact,
  fullWidth,
  onRequestR18,
}: {
  active: boolean;
  compact: boolean;
  fullWidth: boolean;
  onRequestR18: () => void;
}) {
  const className = segmentClass(active, compact, fullWidth);
  const href = getR18SiteUrl();

  if (active) {
    return (
      <span className={className} aria-current="page">
        成人向け【R18】
      </span>
    );
  }

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isAgeVerified()) {
      return;
    }
    event.preventDefault();
    onRequestR18();
  };

  if (isExternalSiteUrl(href)) {
    return (
      <a href={href} className={className} onClick={handleClick}>
        成人向け【R18】
      </a>
    );
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      成人向け【R18】
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
  const router = useRouter();
  const isAllAges = isAllAgesPath(pathname);
  const lockAllAges = isYouTubeWelcomePath(pathname);
  const [gateOpen, setGateOpen] = useState(false);

  const navigateR18 = useCallback(() => {
    const href = getR18SiteUrl();
    if (isExternalSiteUrl(href)) {
      window.location.href = href;
      return;
    }
    router.push(href);
  }, [router]);

  if (lockAllAges) {
    return (
      <div
        role="group"
        aria-label="サイト区分（全年齢向け固定）"
        className={`${fullWidth ? "flex w-full" : "inline-flex"} max-w-full shrink-0 overflow-hidden rounded-full border border-slate-500/55 bg-slate-800/75 p-0.5 shadow-sm ring-1 ring-white/5 ${className}`}
      >
        <span
          className={segmentClass(true, compact, fullWidth)}
          aria-current="page"
        >
          全年齢向け
        </span>
      </div>
    );
  }

  return (
    <>
      <div
        role="group"
        aria-label="サイト区分の切り替え"
        className={`${fullWidth ? "flex w-full" : "inline-flex"} max-w-full shrink-0 overflow-hidden rounded-full border border-slate-500/55 bg-slate-800/75 p-0.5 shadow-sm ring-1 ring-white/5 ${className}`}
      >
        <AllAgesSegment
          active={isAllAges}
          compact={compact}
          fullWidth={fullWidth}
        />
        <R18Segment
          active={!isAllAges}
          compact={compact}
          fullWidth={fullWidth}
          onRequestR18={() => setGateOpen(true)}
        />
      </div>
      <AgeVerificationGate
        open={gateOpen}
        onVerified={() => {
          setGateOpen(false);
          navigateR18();
        }}
      />
    </>
  );
}
