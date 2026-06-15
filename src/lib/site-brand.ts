import { R18_SITE_BASE } from "@/lib/site-rating-switch";

/** サイト名（R18・全年齢共通） */
export const SITE_NAME = "ムキネコ解析室";

/** 運営者 X（旧 Twitter）プロフィール */
export const SITE_X_URL = "https://x.com/aimer010855";

/** 成人向け【R18】サイト名 */
export const SITE_NAME_R18 = SITE_NAME;

/** 全年齢向けサイト名 */
export const SITE_NAME_ALL_AGES = SITE_NAME;

export function isYouTubeWelcomePath(pathname: string): boolean {
  return pathname === "/welcome/youtube" || pathname.startsWith("/welcome/youtube/");
}

export function isAllAgesPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") {
    return true;
  }
  if (isYouTubeWelcomePath(pathname)) {
    return true;
  }
  return pathname === "/all-ages" || pathname.startsWith("/all-ages/");
}

export function isR18SitePath(pathname: string): boolean {
  if (pathname === "/r18" || pathname.startsWith("/r18/")) {
    return true;
  }
  if (isAllAgesPath(pathname)) {
    return false;
  }
  return true;
}

export function getSiteBrandForPath(pathname: string): {
  siteName: string;
  homeHref: string;
} {
  if (isAllAgesPath(pathname)) {
    return {
      siteName: SITE_NAME_ALL_AGES,
      homeHref: isYouTubeWelcomePath(pathname) ? "/welcome/youtube/" : "/",
    };
  }
  return { siteName: SITE_NAME_R18, homeHref: R18_SITE_BASE };
}
