/** 全年齢向けサイトのルート（一覧・検索の basePath 等） */
export const ALL_AGES_SITE_BASE = "/all-ages/";

/** 成人向け【R18】トップ（年齢確認後） */
export const R18_SITE_BASE = "/r18/";

export function getR18SiteUrl(): string {
  const external = process.env.NEXT_PUBLIC_R18_SITE_URL?.trim();
  if (external) {
    return external;
  }
  return R18_SITE_BASE;
}

/** 全年齢トップへのリンク（サイト入口 `/`） */
export function getAllAgesSiteUrl(): string {
  return process.env.NEXT_PUBLIC_ALL_AGES_SITE_URL?.trim() || "/";
}

export function isExternalSiteUrl(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
