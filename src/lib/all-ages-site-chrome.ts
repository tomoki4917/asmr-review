import {
  buildReviewListHref,
  FEATURED_PICKS_HUB_PATH,
  KNOWLEDGE_COLUMNS_HUB_PATH,
  REVIEWS_LIST_FILTERS_ID,
  VOICE_ACTORS_HUB_PATH,
  WORKS_LIST_HUB_PATH,
} from "@/lib/review-list-href";
import type { SiteCategoryLink } from "@/lib/site-category-links";
import { SITE_CATEGORY_LINKS } from "@/lib/site-category-links";
import { SITE_NAME } from "@/lib/site-brand";
import { ALL_AGES_SITE_BASE } from "@/lib/site-rating-switch";

/** 全年齢向け「作品を探す」ハブ */
export const ALL_AGES_WORKS_PATH = `${ALL_AGES_SITE_BASE}works/`;

export const ALL_AGES_WORKS_INTRO = `${SITE_NAME}で掲載している全年齢向け作品レビューの一覧です。
キーワード検索のほか、新しい順・評価別に絞り込み、気になる一本を探せます。`;

function rewriteHrefForAllAges(href: string): string {
  if (href === FEATURED_PICKS_HUB_PATH) {
    return `${ALL_AGES_SITE_BASE}#home-pickup-review-heading`;
  }
  if (href.includes(WORKS_LIST_HUB_PATH)) {
    return href.replaceAll(WORKS_LIST_HUB_PATH, ALL_AGES_WORKS_PATH);
  }
  return href;
}

/** R18 トップの 3×3 カテゴリを全年齢向け URL に差し替え */
export function buildAllAgesCategoryLinks(): SiteCategoryLink[] {
  return SITE_CATEGORY_LINKS.map((item) => ({
    ...item,
    href: rewriteHrefForAllAges(item.href),
  }));
}

export const ALL_AGES_LIST_FILTERS_HASH = `#${REVIEWS_LIST_FILTERS_ID}`;

export function allAgesReviewListHref(
  options: Parameters<typeof buildReviewListHref>[1] = {}
): string {
  return buildReviewListHref(ALL_AGES_SITE_BASE, options);
}

/** 声優ハブなど R18 専用ページへのリンク（全年齢トップからのクロスリンク） */
export const ALL_AGES_CROSS_LINKS = {
  voiceActors: VOICE_ACTORS_HUB_PATH,
  knowledge: KNOWLEDGE_COLUMNS_HUB_PATH,
} as const;
