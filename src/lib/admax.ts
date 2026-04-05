/**
 * 忍者AdMax の script URL。
 * `NEXT_PUBLIC_ADMAX_*` があればそれを優先し、未設定時はこのサイト既定の枠（公開前と同じ表示）。
 */

function env(name: string): string {
  if (typeof process === "undefined") return "";
  return process.env[name]?.trim() ?? "";
}

/** 記事上・記事下などインライン枠 */
const DEFAULT_INLINE =
  "https://adm.shinobi.jp/s/63004686f9ce616d0deca54601447538";

/** トップ枠 */
const DEFAULT_HOME_TOP =
  "https://adm.shinobi.jp/s/bb60bb7ee64a03afc45de9007debad57";

export const ADMAX_SCRIPT_SRC =
  env("NEXT_PUBLIC_ADMAX_SCRIPT_INLINE") || DEFAULT_INLINE;

export const ADMAX_SCRIPT_SRC_HOME_TOP =
  env("NEXT_PUBLIC_ADMAX_SCRIPT_HOME_TOP") || DEFAULT_HOME_TOP;

const mobileOverride = env("NEXT_PUBLIC_ADMAX_SCRIPT_MOBILE");

/** スマホ用 MPU。未設定時はインラインと同じ URL */
export const ADMAX_SCRIPT_SRC_MOBILE =
  mobileOverride || ADMAX_SCRIPT_SRC;
