import { QUICK_GUIDE_KINK_BY_SLUG } from "@/lib/quick-guide-kink-by-slug";
import type { Review } from "@/lib/types";

export type VoiceActorToneId = "ama" | "ds" | "dm";

export const VOICE_ACTOR_TONE_LABELS: Record<VoiceActorToneId, string> = {
  ama: "甘々系",
  ds: "ドS系",
  dm: "ドM系",
};

export function parseVoiceActorToneId(
  raw: string | null
): VoiceActorToneId | null {
  if (raw === "ama" || raw === "ds" || raw === "dm") return raw;
  return null;
}

export function reviewMatchesVoiceActorTone(
  review: Review,
  tone: VoiceActorToneId
): boolean {
  const kink = QUICK_GUIDE_KINK_BY_SLUG[review.slug];
  const tags = review.tags;

  if (tone === "dm") {
    if (kink === "ドM" || kink === "M向け" || kink === "M推奨") return true;
    return tags.some((t) => /マゾ|ドM|M向け/.test(t));
  }

  if (tone === "ama") {
    if (kink === "ノーマル") return true;
    if (kink === "ノーマル〜M向け") return true;
    return tags.some((t) => /甘々|癒し|優しい|初心者/.test(t));
  }

  // ドS系：洗脳・支配寄りで、明確な M 推奨ラベルだけを除外
  if (kink === "M推奨" || kink === "ドM") return false;
  if (tags.includes("洗脳")) return true;
  if (kink === "M向け" && tags.some((t) => /レイプ|罵倒|言責め|支配/.test(t))) {
    return true;
  }
  return false;
}
