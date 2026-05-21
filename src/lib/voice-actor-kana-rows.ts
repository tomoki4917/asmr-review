/** 五十音行フィルタ（濁点・半濁点を各行に含める） */
export type KanaRowId =
  | "a"
  | "ka"
  | "sa"
  | "ta"
  | "na"
  | "ha"
  | "ma"
  | "ya"
  | "ra"
  | "wa";

export type KanaRowSpec = {
  id: KanaRowId;
  label: string;
  chars: readonly string[];
};

export const VOICE_ACTOR_KANA_ROWS: readonly KanaRowSpec[] = [
  { id: "a", label: "あ行", chars: ["あ", "い", "う", "え", "お"] },
  {
    id: "ka",
    label: "か行",
    chars: [
      "か",
      "き",
      "く",
      "け",
      "こ",
      "が",
      "ぎ",
      "ぐ",
      "げ",
      "ご",
    ],
  },
  {
    id: "sa",
    label: "さ行",
    chars: [
      "さ",
      "し",
      "す",
      "せ",
      "そ",
      "ざ",
      "じ",
      "ず",
      "ぜ",
      "ぞ",
    ],
  },
  {
    id: "ta",
    label: "た行",
    chars: [
      "た",
      "ち",
      "つ",
      "て",
      "と",
      "だ",
      "ぢ",
      "づ",
      "で",
      "ど",
    ],
  },
  { id: "na", label: "な行", chars: ["な", "に", "ぬ", "ね", "の"] },
  {
    id: "ha",
    label: "は行",
    chars: [
      "は",
      "ひ",
      "ふ",
      "へ",
      "ほ",
      "ば",
      "び",
      "ぶ",
      "べ",
      "ぼ",
      "ぱ",
      "ぴ",
      "ぷ",
      "ぺ",
      "ぽ",
    ],
  },
  { id: "ma", label: "ま行", chars: ["ま", "み", "む", "め", "も"] },
  { id: "ya", label: "や行", chars: ["や", "ゆ", "よ"] },
  { id: "ra", label: "ら行", chars: ["ら", "り", "る", "れ", "ろ"] },
  { id: "wa", label: "わ行", chars: ["わ", "を", "ん"] },
] as const;

const ROW_CHAR_SETS: Record<KanaRowId, Set<string>> = Object.fromEntries(
  VOICE_ACTOR_KANA_ROWS.map((row) => [
    row.id,
    new Set(row.chars.map((c) => toHiragana(c))),
  ])
) as Record<KanaRowId, Set<string>>;

export function toHiragana(char: string): string {
  const code = char.codePointAt(0);
  if (code == null) return char;
  if (code >= 0x30a1 && code <= 0x30f6) {
    return String.fromCodePoint(code - 0x60);
  }
  return char;
}

function isKanaChar(char: string): boolean {
  const code = char.codePointAt(0);
  if (code == null) return false;
  return (
    (code >= 0x3041 && code <= 0x309f) ||
    (code >= 0x30a1 && code <= 0x30f6)
  );
}

/** 文字列内の先頭かな（括弧内を優先） */
export function extractLeadingKana(
  name: string,
  rawLine?: string
): string | null {
  if (rawLine) {
    const parenMatches = rawLine.matchAll(/[（(]([^）)]+)[）)]/g);
    for (const m of parenMatches) {
      const k = firstKanaInString(m[1]);
      if (k) return k;
    }
  }
  return firstKanaInString(name);
}

function firstKanaInString(text: string): string | null {
  for (const ch of text) {
    if (isKanaChar(ch)) return toHiragana(ch);
  }
  return null;
}

export function kanaRowIdForChar(char: string | null): KanaRowId | null {
  if (!char) return null;
  const h = toHiragana(char);
  for (const row of VOICE_ACTOR_KANA_ROWS) {
    if (ROW_CHAR_SETS[row.id].has(h)) return row.id;
  }
  return null;
}

export function parseKanaRowId(raw: string | null): KanaRowId | null {
  if (!raw) return null;
  return VOICE_ACTOR_KANA_ROWS.some((r) => r.id === raw)
    ? (raw as KanaRowId)
    : null;
}

export function voiceActorMatchesKanaRow(
  indexKana: string | null,
  rowId: KanaRowId
): boolean {
  return kanaRowIdForChar(indexKana) === rowId;
}
