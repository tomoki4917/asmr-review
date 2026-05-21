import {
  featuredSlugsForVoiceActor,
  sortReviewSlugsWithFeatured,
} from "@/lib/voice-actor-hub-picks";
import {
  extractLeadingKana,
  kanaRowIdForChar,
  type KanaRowId,
} from "@/lib/voice-actor-kana-rows";
import type { Review } from "@/lib/types";

export type VoiceActorHubEntry = {
  /** 表示名（括弧前の主名） */
  name: string;
  slug: string;
  reviewSlugs: string[];
  /** ハブで先に案内するレビュー slug */
  featuredSlugs: string[];
  /** 五十音フィルタ用の先頭かな（括弧内読み優先） */
  indexKana: string | null;
  kanaRowId: KanaRowId | null;
};

const VOICE_LINE_RE = /^- \*\*声優：\*\* (.+)$/m;

/** 括弧・読点で分割し、役名・「ほか」は除く */
export function splitVoiceActorNames(raw: string): string[] {
  const cleaned = raw
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/ほか.*$/u, "")
    .trim();
  return cleaned
    .split(/[、,／/・]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^同一台本/.test(s));
}

export function parseVoiceActorLine(body: string): string | undefined {
  const m = body.match(VOICE_LINE_RE);
  return m?.[1]?.trim();
}

export function voiceActorNameToSlug(name: string): string {
  return encodeURIComponent(name.trim());
}

export function collectVoiceActorHubEntries(
  reviews: Review[]
): VoiceActorHubEntry[] {
  const map = new Map<string, VoiceActorHubEntry>();

  for (const review of reviews) {
    if (review.contentKind !== "review") continue;
    const raw = parseVoiceActorLine(review.body);
    if (!raw) continue;
    for (const name of splitVoiceActorNames(raw)) {
      const slug = voiceActorNameToSlug(name);
      const indexKana = extractLeadingKana(name, raw);
      const existing = map.get(name);
      if (existing) {
        if (!existing.reviewSlugs.includes(review.slug)) {
          existing.reviewSlugs.push(review.slug);
        }
        if (!existing.indexKana && indexKana) {
          existing.indexKana = indexKana;
          existing.kanaRowId = kanaRowIdForChar(indexKana);
        }
      } else {
        map.set(name, {
          name,
          slug,
          reviewSlugs: [review.slug],
          featuredSlugs: featuredSlugsForVoiceActor(name),
          indexKana,
          kanaRowId: kanaRowIdForChar(indexKana),
        });
      }
    }
  }

  for (const entry of map.values()) {
    entry.featuredSlugs = featuredSlugsForVoiceActor(entry.name);
    entry.reviewSlugs = sortReviewSlugsWithFeatured(
      entry.reviewSlugs,
      entry.featuredSlugs
    );
  }

  return [...map.values()].sort((a, b) => {
    const aFeatured = a.featuredSlugs.length > 0 ? 0 : 1;
    const bFeatured = b.featuredSlugs.length > 0 ? 0 : 1;
    if (aFeatured !== bFeatured) return aFeatured - bFeatured;
    return a.name.localeCompare(b.name, "ja");
  });
}

export function reviewMatchesVoiceActorName(
  review: Review,
  voiceQuery: string
): boolean {
  const raw = parseVoiceActorLine(review.body);
  if (!raw) return false;
  const decoded = decodeURIComponent(voiceQuery);
  return splitVoiceActorNames(raw).some(
    (n) => n === decoded || raw.includes(decoded)
  );
}
