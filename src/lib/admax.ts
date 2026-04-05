/**
 * 忍者AdMax の script URL はすべて環境変数から読み込み（リポジトリに ID を直書きしない）。
 * ビルド前に .env に設定してください。
 */

function env(name: string): string {
  if (typeof process === "undefined") return "";
  return process.env[name]?.trim() ?? "";
}

/** 記事上・記事下などインライン枠 — NEXT_PUBLIC_ADMAX_SCRIPT_INLINE */
export const ADMAX_SCRIPT_SRC = env("NEXT_PUBLIC_ADMAX_SCRIPT_INLINE");

/** トップ枠 — NEXT_PUBLIC_ADMAX_SCRIPT_HOME_TOP */
export const ADMAX_SCRIPT_SRC_HOME_TOP = env("NEXT_PUBLIC_ADMAX_SCRIPT_HOME_TOP");

const mobileOverride = env("NEXT_PUBLIC_ADMAX_SCRIPT_MOBILE");

/**
 * スマホ用 MPU。未設定時はインラインと同じ URL を使う。
 * NEXT_PUBLIC_ADMAX_SCRIPT_MOBILE
 */
export const ADMAX_SCRIPT_SRC_MOBILE = mobileOverride || ADMAX_SCRIPT_SRC;
