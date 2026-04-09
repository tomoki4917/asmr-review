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

  /** ビューポートに合わせた max-height（スマホで縦に潰れて見えなくなるのを防ぐ） */
  const sizeClass =
    variant === "summary"
      ? "max-h-[min(18rem,85vh)] sm:max-h-96"
      : "max-h-[min(26rem,80vh)] sm:max-h-[28rem] md:max-h-[32rem]";

  return (
    <span className="my-5 block w-full min-w-0 max-w-full overflow-x-auto rounded-xl border border-slate-600/40 bg-slate-900/40">
      {/* eslint-disable-next-line @next/next/no-img-element -- 外部・任意 URL のため */}
      <img
        src={s.trim()}
        alt={alt != null && typeof alt === "string" ? alt : ""}
        className={`mx-auto block h-auto w-full min-h-0 max-w-full object-contain object-center ${sizeClass}`}
        loading="lazy"
        decoding="async"
        sizes="(max-width: 640px) 100vw, 896px"
      />
    </span>
  );
}
