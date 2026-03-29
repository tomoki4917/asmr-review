import type { ReactNode } from "react";
import type { AffiliateLink, AffiliateVendor } from "@/lib/types";

const defaultLabels: Record<AffiliateVendor, string> = {
  dlsite: "DLsite",
  amazon: "Amazon",
};

export type AffiliateButtonProps = {
  link: AffiliateLink;
  className?: string;
  /** 将来: APIから注入するセール文言・バッジなど */
  badge?: ReactNode;
};

/**
 * アフィリエイト導線用ボタン。
 * `link.badgeText` は将来のAPI連携用の予約フィールド（現状は未使用でも拡張しやすい形に）。
 */
export function AffiliateButton({ link, className = "", badge }: AffiliateButtonProps) {
  const label = link.label ?? defaultLabels[link.vendor] ?? link.vendor;
  const apiBadge = link.badgeText ? (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
      {link.badgeText}
    </span>
  ) : null;

  return (
    <a
      href={link.href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className={[
        "inline-flex min-h-12 min-w-[min(100%,11rem)] items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-medium text-stone-800 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/80 active:scale-[0.98] dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-950/30",
        className,
      ].join(" ")}
    >
      <span>{label}</span>
      {apiBadge}
      {badge}
    </a>
  );
}

export type AffiliateButtonGroupProps = {
  links: AffiliateLink[];
  className?: string;
  /** リンクごとにバッジを差し込む（将来のセールAPI用） */
  renderBadge?: (link: AffiliateLink) => ReactNode;
};

export function AffiliateButtonGroup({
  links,
  className = "",
  renderBadge,
}: AffiliateButtonGroupProps) {
  if (links.length === 0) return null;

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap ${className}`}>
      {links.map((link, i) => (
        <AffiliateButton
          key={`${link.vendor}-${link.href}-${i}`}
          link={link}
          badge={renderBadge?.(link)}
        />
      ))}
    </div>
  );
}
