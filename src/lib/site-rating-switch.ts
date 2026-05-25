/** 全年齢向けサイトのルート（同一リポジトリ内・任意） */
export const ALL_AGES_SITE_BASE = "/all-ages/";

export function getR18SiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_R18_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return raw || "/";
}

export function getAllAgesSiteUrl(): string {
  return process.env.NEXT_PUBLIC_ALL_AGES_SITE_URL?.trim() || ALL_AGES_SITE_BASE;
}

export function isExternalSiteUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
