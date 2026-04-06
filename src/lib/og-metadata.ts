/**
 * OGP / Twitter 用の絶対 URL 解決。
 * フォールバック: `NEXT_PUBLIC_OGP_FALLBACK_IMAGE`（省略時は `/ogp-fallback.png`）
 */

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** 記事サムネ（coverImage）を絶対 URL に。未設定・不正なら undefined */
export function absoluteCoverImageUrl(
  coverImage: string | undefined
): string | undefined {
  if (!coverImage?.trim()) return undefined;
  const c = coverImage.trim();
  if (c.startsWith("/")) {
    return new URL(c, siteUrl()).toString();
  }
  if (c.startsWith("http://") || c.startsWith("https://")) {
    return c;
  }
  return undefined;
}

/**
 * デフォルト OGP / Twitter 画像の絶対 URL。
 * `NEXT_PUBLIC_OGP_FALLBACK_IMAGE` に http(s) URL または `/path` を指定可能。
 */
export function absoluteFallbackOgUrl(): string {
  const raw = process.env.NEXT_PUBLIC_OGP_FALLBACK_IMAGE?.trim();
  if (raw) {
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return new URL(path, siteUrl()).toString();
  }
  return new URL("/ogp-fallback.png", siteUrl()).toString();
}

export function resolveSocialPreviewImage(review: {
  coverImage?: string;
  title: string;
}): { url: string; alt: string } {
  const fromCover = absoluteCoverImageUrl(review.coverImage);
  if (fromCover) {
    return { url: fromCover, alt: review.title };
  }
  return {
    url: absoluteFallbackOgUrl(),
    alt: review.title,
  };
}
