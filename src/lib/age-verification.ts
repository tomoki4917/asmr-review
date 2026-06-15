/** 成人向け【R18】エリアへ入る前の年齢確認（localStorage・90日） */
export const AGE_VERIFIED_STORAGE_KEY = "asmr_review_age_verified_until_v3";

export const AGE_VERIFIED_NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function getAgeVerifiedUntil(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AGE_VERIFIED_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isAgeVerified(now = Date.now()): boolean {
  const verifiedUntil = getAgeVerifiedUntil();
  return verifiedUntil !== null && verifiedUntil > now;
}

export function setAgeVerified(now = Date.now()): void {
  const verifiedUntil = now + AGE_VERIFIED_NINETY_DAYS_MS;
  window.localStorage.setItem(AGE_VERIFIED_STORAGE_KEY, String(verifiedUntil));
}
