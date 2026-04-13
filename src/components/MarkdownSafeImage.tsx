type Props = {
  /** react-markdown の型は string | Blob などを含むため文字列のみ採用 */
  src?: string | Blob;
  alt?: string | null;
  /** 紹介文はややコンパクト、本文は広めに */
  variant?: "summary" | "body";
};

export function isSafeMarkdownImageSrc(src: string): boolean {
  const s = src.trim();
  return (
    s.startsWith("https://") ||
    s.startsWith("http://") ||
    s.startsWith("/")
  );
}

/** alt に含まれると円形クロップ表示（装飾指定。img の alt からは除去する） */
function isCircleImageAlt(alt: string | null | undefined): boolean {
  if (alt == null || typeof alt !== "string") return false;
  return (
    alt.includes("（丸型）") || alt.includes("(丸型)") || alt.toLowerCase().includes("(circle)")
  );
}

/** 作品感想など、本文横に小さく並べる（丸型と併用） */
function isAsideCircleAlt(alt: string | null | undefined): boolean {
  if (alt == null || typeof alt !== "string") return false;
  return alt.includes("（横並び）") || alt.includes("(横並び)");
}

function stripCircleMarkerFromAlt(alt: string): string {
  return alt
    .replace(/\s*（丸型）\s*/g, " ")
    .replace(/\s*\(丸型\)\s*/g, " ")
    .replace(/\s*（横並び）\s*/g, " ")
    .replace(/\s*\(横並び\)\s*/g, " ")
    .replace(/\s*\(circle\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function MarkdownSafeImage({ src, alt, variant = "body" }: Props) {
  const s = typeof src === "string" ? src : "";
  if (!isSafeMarkdownImageSrc(s)) return null;

  const altStr = alt != null && typeof alt === "string" ? alt : "";
  const circle = isCircleImageAlt(altStr);
  const aside = circle && isAsideCircleAlt(altStr);
  const altForImg = circle ? stripCircleMarkerFromAlt(altStr) : altStr;

  /** ビューポートに合わせた max-height（スマホで縦に潰れて見えなくなるのを防ぐ） */
  const sizeClass =
    variant === "summary"
      ? "max-h-[min(18rem,85vh)] sm:max-h-96"
      : "max-h-[min(26rem,80vh)] sm:max-h-[28rem] md:max-h-[32rem]";

  if (circle && aside) {
    return (
      <span className="review-md-aside-circle float-right ml-3 mt-1 inline-block max-w-[min(5rem,28vw)] shrink-0 sm:ml-4 sm:max-w-[5.5rem]">
        {/* eslint-disable-next-line @next/next/no-img-element -- 外部・任意 URL のため */}
        <img
          src={s.trim()}
          alt={altForImg}
          className="h-16 w-16 rounded-full border-2 border-slate-600/50 bg-slate-900/40 object-cover object-center shadow-[0_4px_14px_rgba(0,0,0,0.35)] sm:h-20 sm:w-20"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  if (circle) {
    return (
      <span className="my-5 flex w-full min-w-0 max-w-full justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- 外部・任意 URL のため */}
        <img
          src={s.trim()}
          alt={altForImg}
          className="h-44 w-44 shrink-0 rounded-full border-2 border-slate-600/50 bg-slate-900/40 object-cover object-center shadow-[0_8px_24px_rgba(0,0,0,0.35)] sm:h-52 sm:w-52"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <span className="my-5 block w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-slate-600/40 bg-slate-900/40">
      {/* eslint-disable-next-line @next/next/no-img-element -- 外部・任意 URL のため */}
      <img
        src={s.trim()}
        alt={altForImg}
        className={`mx-auto block h-auto w-full min-h-0 max-w-full object-contain object-center ${sizeClass}`}
        loading="lazy"
        decoding="async"
        sizes="(max-width: 640px) 100vw, 896px"
      />
    </span>
  );
}
