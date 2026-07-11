import type { ReactNode } from "react";
import type { AffiliateLink, AffiliateVendor } from "@/lib/types";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";

const defaultLabels: Record<AffiliateVendor, string> = {
  dlsite: "DLsite",
  amazon: "Amazon",
};

export type AffiliateButtonProps = {
  link: AffiliateLink;
  className?: string;
  /** 将来: APIから注入するセール文言・バッジなど */
  badge?: ReactNode;
  /** 購入ボタン直上のアフィリエイト開示（既定: false。ページ内で1回だけ表示する） */
  showDisclosure?: boolean;
};

/**
 * アフィリエイト導線用ボタン。
 * `link.badgeText` は将来のAPI連携用の予約フィールド（現状は未使用でも拡張しやすい形に）。
 */
export function AffiliateButton({
  link,
  className = "",
  badge,
  showDisclosure = false,
}: AffiliateButtonProps) {
  const label = link.label ?? defaultLabels[link.vendor] ?? link.vendor;
  const apiBadge = link.badgeText ? (
    <span className="relative z-[1] rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs font-medium text-white/95">
      {link.badgeText}
    </span>
  ) : null;

  const button = (
    <a
      href={link.href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className={[
        "group relative inline-flex min-h-[3.25rem] w-full min-w-[min(100%,12rem)] items-center justify-center gap-2 overflow-hidden rounded-2xl px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-sky-600/25 ring-1 ring-sky-300/35 transition sm:w-auto",
        "bg-gradient-to-br from-sky-500 via-sky-600 to-cyan-700",
        "hover:scale-[1.02] hover:shadow-xl hover:shadow-sky-400/35 hover:ring-sky-200/45",
        "active:scale-[0.98]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300/80",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent before:opacity-0 before:transition-opacity hover:before:opacity-100",
        className,
      ].join(" ")}
    >
      <span className="relative z-[1] drop-shadow-sm">{label}</span>
      {apiBadge}
      {badge}
    </a>
  );

  if (!showDisclosure) return button;

  return (
    <div className="flex w-full flex-col gap-2">
      <AffiliateDisclosure />
      {button}
    </div>
  );
}

export type AffiliateButtonGroupProps = {
  links: AffiliateLink[];
  className?: string;
  /** リンクごとにバッジを差し込む（将来のセールAPI用） */
  renderBadge?: (link: AffiliateLink) => ReactNode;
  /** 購入ボタン直上のアフィリエイト開示（既定: false。ページ内で1回だけ表示する） */
  showDisclosure?: boolean;
};

export function AffiliateButtonGroup({
  links,
  className = "",
  renderBadge,
  showDisclosure = false,
}: AffiliateButtonGroupProps) {
  if (links.length === 0) return null;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {showDisclosure ? <AffiliateDisclosure /> : null}
      {links.map((link, i) => (
        <AffiliateButton
          key={`${link.vendor}-${link.href}-${i}`}
          link={link}
          badge={renderBadge?.(link)}
          showDisclosure={false}
        />
      ))}
    </div>
  );
}
