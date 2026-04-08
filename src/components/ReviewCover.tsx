"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  coverImage: string | undefined;
  alt: string;
  slug: string;
  priority?: boolean;
  className?: string;
  /** 一覧カードは 16:10、記事ヘッダーは hero */
  variant?: "card" | "hero";
  /** fill 画像・img に付与（object-fit / object-position など） */
  imageClassName?: string;
};

function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h + s.charCodeAt(i) * (i + 1)) % 360;
  return h;
}

export function ReviewCoverPlaceholder({ slug, className = "" }: { slug: string; className?: string }) {
  const h = hueFromString(slug);
  const h2 = (h + 48) % 360;
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
      style={{
        background: `linear-gradient(145deg, hsl(${h}, 42%, 28%) 0%, hsl(${h2}, 38%, 14%) 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-[12%] -top-[18%] h-[72%] w-[72%] rounded-full opacity-25 blur-3xl"
        style={{ background: `hsl(${(h + 120) % 360}, 55%, 45%)` }}
      />
      <div
        className="pointer-events-none absolute -bottom-[14%] -left-[12%] h-[62%] w-[62%] rounded-full opacity-20 blur-3xl"
        style={{ background: `hsl(${(h + 220) % 360}, 50%, 50%)` }}
      />
    </div>
  );
}

export function isSvgCoverPath(src: string): boolean {
  const path = src.split("?")[0] ?? src;
  return path.toLowerCase().endsWith(".svg");
}

export function ReviewCover({
  coverImage,
  alt,
  slug,
  priority = false,
  className = "",
  variant = "card",
  /** 表紙のトリミングを減らす（上下に余白が付く場合は背景色で埋まる） */
  imageClassName = "object-contain object-center",
}: Props) {
  const [loadFailed, setLoadFailed] = useState(false);
  const aspect =
    variant === "hero"
      ? "aspect-[16/9] min-h-0 sm:aspect-[2/1]"
      : "aspect-[16/10] min-h-0";
  const wrap = `relative ${aspect} min-w-0 w-full max-w-full overflow-hidden bg-slate-900 ${className}`;

  if (!coverImage || loadFailed) {
    return (
      <div className={wrap}>
        <ReviewCoverPlaceholder slug={slug} />
      </div>
    );
  }

  const isLocal = coverImage.startsWith("/");
  const isRemote =
    coverImage.startsWith("http://") || coverImage.startsWith("https://");

  if (isLocal) {
    if (isSvgCoverPath(coverImage)) {
      return (
        <div className={wrap}>
          {/* SVG は next/image fill と Grid 相性でレイアウトが壊れるため img で収める */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImage}
            alt={alt}
            className={`absolute inset-0 h-full w-full ${imageClassName}`}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onError={() => setLoadFailed(true)}
          />
        </div>
      );
    }
    return (
      <div className={wrap}>
        {/* 静的 export・未配置ファイル時の 404 でもプレースホルダに落とすため img + onError */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverImage}
          alt={alt}
          className={`absolute inset-0 h-full w-full ${imageClassName}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setLoadFailed(true)}
        />
      </div>
    );
  }

  if (isRemote) {
    return (
      <div className={wrap}>
        <Image
          src={coverImage}
          alt={alt}
          fill
          unoptimized
          className={imageClassName}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={priority}
          onError={() => setLoadFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={wrap}>
      <ReviewCoverPlaceholder slug={slug} />
    </div>
  );
}
