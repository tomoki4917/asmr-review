/** 記事上・記事下・インライン枠用（MPU 等） */
export const ADMAX_SCRIPT_SRC =
  "https://adm.shinobi.jp/s/63004686f9ce616d0deca54601447538";

/** トップページ用（PC はリーダーボード等の大きめ枠向けタグ） */
export const ADMAX_SCRIPT_SRC_HOME_TOP =
  "https://adm.shinobi.jp/s/bb60bb7ee64a03afc45de9007debad57";

/**
 * 幅 768px 未満で使う MPU（300×250）用。
 * 忍者AdMax でスマホ専用タグを発行したら `NEXT_PUBLIC_ADMAX_SCRIPT_MOBILE` に設定。
 * 未設定時は `ADMAX_SCRIPT_SRC` と同じ。
 */
export const ADMAX_SCRIPT_SRC_MOBILE =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_ADMAX_SCRIPT_MOBILE?.trim()) ||
  ADMAX_SCRIPT_SRC;
