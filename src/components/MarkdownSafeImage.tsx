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

export function MarkdownSafeImage({ src, alt, variant = "body" }: Props) {
  const s = typeof src === "string" ? src : "";
  if (!isSafeMarkdownImageSrc(s)) return null;

  const sizeClass =
    variant === "summary"
      ? "max-h-72 sm:max-h-96"
      : "max-h-[28rem] sm:max-h-[32rem]";

  return (
    <span className="my-5 block overflow-hidden rounded-xl border border-slate-600/40 bg-slate-900/40">
      {/* eslint-disable-next-line @next/next/no-img-element -- 外部・任意 URL のため */}
      <img
        src={s.trim()}
        alt={alt != null && typeof alt === "string" ? alt : ""}
        className={`w-full object-contain ${sizeClass}`}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
