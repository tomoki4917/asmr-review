import { ALL_AGES_SITE_BASE } from "@/lib/site-rating-switch";

/** サイト名（R18・全年齢共通） */
export const SITE_NAME = "ムキネコ解析室";

/** 成人向け【R18】サイト名 */
export const SITE_NAME_R18 = SITE_NAME;

/** 全年齢向けサイト名 */
export const SITE_NAME_ALL_AGES = SITE_NAME;

export function isAllAgesPath(pathname: string): boolean {
  return pathname === "/all-ages" || pathname.startsWith("/all-ages/");
}

export function getSiteBrandForPath(pathname: string): {
  siteName: string;
  homeHref: string;
} {
  if (isAllAgesPath(pathname)) {
    return { siteName: SITE_NAME_ALL_AGES, homeHref: ALL_AGES_SITE_BASE };
  }
  return { siteName: SITE_NAME_R18, homeHref: "/" };
}
