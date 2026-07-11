import { reviewTitleSingleLine } from "@/lib/review-title";

/**
 * OGP / Twitter 用の絶対 URL 解決。
 * フォールバック: `NEXT_PUBLIC_OGP_FALLBACK_IMAGE`（省略時は `/ogp-fallback.png`）
 */

const PRODUCTION_SITE_URL = "https://asmr-reviewrabo.com";

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** sitemap / robots 等、本番ドメインが必要な静的出力用 */
export function canonicalSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return PRODUCTION_SITE_URL;
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
  const titleAlt = reviewTitleSingleLine(review.title);
  if (fromCover) {
    return { url: fromCover, alt: titleAlt };
  }
  return {
    url: absoluteFallbackOgUrl(),
    alt: titleAlt,
  };
}
