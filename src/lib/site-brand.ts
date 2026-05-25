import { ALL_AGES_SITE_BASE } from "@/lib/site-rating-switch";

/** 成人向け【R18】サイト名 */
export const SITE_NAME_R18 = "催眠音声解析室";

/** 全年齢向けサイト名 */
export const SITE_NAME_ALL_AGES = "同人音声解析室";

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
