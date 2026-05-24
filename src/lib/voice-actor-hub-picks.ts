/**
 * 声優別ハブで先頭に出すおすすめレビュー（手動キュレーション）。
 * `quickGuideBySlug` の voiceActor と突合する表示名でキーを書く。
 */
export const VOICE_ACTOR_HUB_FEATURED_BY_NAME: Record<string, readonly string[]> = {
  逢坂成美: ["dandan-gehin-ni-naru-saimin"],
};

export function featuredSlugsForVoiceActor(name: string): string[] {
  return [...(VOICE_ACTOR_HUB_FEATURED_BY_NAME[name] ?? [])];
}

export function sortReviewSlugsWithFeatured(
  slugs: string[],
  featured: string[]
): string[] {
  const rest = slugs.filter((s) => !featured.includes(s));
  return [...featured.filter((s) => slugs.includes(s)), ...rest];
}
