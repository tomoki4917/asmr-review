import type { Review } from "@/lib/types";

type Props = {
  value: Review["ratingValue"];
  best?: number;
  /** 一覧は sm、記事は md */
  size?: "sm" | "md";
  className?: string;
};

function Star({
  fill,
  variant,
}: {
  fill: number;
  variant: "default" | "perfect";
}) {
  const pct = Math.round(Math.min(Math.max(fill, 0), 1) * 100);
  const fillClass =
    variant === "perfect" ? "text-red-400" : "text-amber-300";
  return (
    <span className="relative inline-block h-[1em] w-[1em] shrink-0">
      <svg
        className="absolute inset-0 text-slate-600"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${pct}%` }}
      >
        <svg
          className={`h-[1em] w-[1em] ${fillClass}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      </span>
    </span>
  );
}

export function StarRating({ value, best = 10, size = "sm", className = "" }: Props) {
  const stars = 5;
  const normalized = (value / best) * stars;
  const em = size === "md" ? "1.125rem" : "0.95rem";
  const isPerfect = best > 0 && value === best;
  const variant = isPerfect ? "perfect" : "default";

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${
        isPerfect ? "drop-shadow-[0_0_12px_rgba(248,113,113,0.35)]" : ""
      } ${className}`}
      style={{ fontSize: em }}
      role="img"
      aria-label={`評価 ${value} / ${best}`}
    >
      <span className="flex gap-0.5" aria-hidden>
        {Array.from({ length: stars }, (_, i) => (
          <Star key={i} fill={normalized - i} variant={variant} />
        ))}
      </span>
      <span
        className={`text-sm font-semibold tabular-nums ${
          isPerfect ? "text-red-400" : "text-slate-200"
        }`}
        aria-hidden
      >
        {value}
        <span
          className={`font-normal ${isPerfect ? "text-red-400/85" : "text-slate-500"}`}
        >
          /{best}
        </span>
      </span>
    </div>
  );
}
