/**
 * ドライシーン回数の再発防止（index ↔ scenario-facts ↔ _分析データ.json）。
 * ガイド: docs/真催眠音声執筆ガイド.md §1（補・絶頂行）
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
const REVIEW_ROOT = path.join(process.cwd(), "src", "content", "レビュー");

function stripFrontmatterAndQuotes(md) {
  const body = md.replace(/^---[\s\S]*?---\n?/, "");
  return body.replace(/^>.*$/gm, "");
}

/** `ドライシーン3回` など整数。複数回・未記載は null */
export function parseDrySceneInteger(text) {
  if (!text) return null;
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (/ドライシーン\s*複数回/.test(normalized)) return null;
  const m =
    normalized.match(/ドライシーン\s*([0-9]+)\s*回/) ??
    normalized.match(/ドライ\s*([0-9]+)\s*回/);
  return m ? Number.parseInt(m[1], 10) : null;
}

function extractDryIntegerFromOrgasmSummary(summary) {
  if (!summary || typeof summary !== "string") return null;
  return parseDrySceneInteger(summary);
}

/** 総合評価ブロックの絶頂行だけ */
function dryLineFromIndex(indexMd) {
  const body = indexMd.replace(/^---[\s\S]*?---\n?/, "");
  const m = body.match(
    /## 総合評価[\s\S]*?(- \*\*ドライシーン[^*\n]+)/m
  );
  return m?.[1] ?? "";
}

/**
 * @param {object} opts
 * @param {string} opts.indexMd
 * @param {object | null} opts.facts scenario-facts.json
 * @param {object | null} opts.analysisData _分析データ.json
 */
export function auditDryOrgasmCount({ indexMd, facts, analysisData }) {
  const errors = [];
  const warnings = [];

  const indexDry = parseDrySceneInteger(dryLineFromIndex(indexMd));
  const analysisDry = extractDryIntegerFromOrgasmSummary(
    analysisData?.orgasmSummary
  );
  const factsCount = Array.isArray(facts?.dryOrgasmArrivals)
    ? facts.dryOrgasmArrivals.length
    : null;

  if (indexDry != null && analysisDry != null && indexDry !== analysisDry) {
    errors.push(
      `絶頂行 ドライシーン${indexDry}回 と _分析データ.json orgasmSummary（${analysisDry}回）が不一致`
    );
  }

  if (indexDry != null && factsCount != null && indexDry !== factsCount) {
    errors.push(
      `絶頂行 ドライシーン${indexDry}回 と scenario-facts dryOrgasmArrivals（${factsCount}件）が不一致`
    );
  }

  if (indexDry != null && indexDry >= 2 && factsCount === 1) {
    errors.push(
      `scenario-facts は到達回収1件なのに index がドライシーン${indexDry}回（終盤の「いっちゃう」と321後を同一波に数え直す）`
    );
  }

  const prose = stripFrontmatterAndQuotes(indexMd);
  if (indexDry === 1) {
    if (/第\s*[2-9２-９]\s*峰|[2-9２-９]\s*峰/.test(prose)) {
      errors.push(
        "絶頂行はドライシーン1回なのに本文に「2峰」等の複数峰表現が残っています"
      );
    }
    if (/ドライシーン\s*[2-9２-９]\s*回/.test(prose)) {
      errors.push(
        "絶頂行はドライシーン1回なのに別箇所にドライシーン2回以上の表記があります"
      );
    }
  }

  const dryLine = dryLineFromIndex(indexMd);
  if (
    facts?.passes === 3 &&
    (/ドライシーン[^*]*（/.test(dryLine) || /ウェットシーン[^*]*（/.test(dryLine))
  ) {
    errors.push(
      "絶頂行のドライ／ウェットに括弧説明を付けない（`- **ドライシーン1回**、**ウェットシーン0回**` のみ）"
    );
  }

  const hasDryLine =
    /ドライシーン/.test(indexMd) || /ドライ\s*\d+回/.test(indexMd);
  if (
    hasDryLine &&
    factsCount != null &&
    factsCount > 0 &&
    (!facts?.dryOrgasmExcluded || facts.dryOrgasmExcluded.length === 0)
  ) {
    warnings.push(
      "scenario-facts に dryOrgasmExcluded がありません（数えない台詞のメモ推奨）"
    );
  }

  if (
    hasDryLine &&
    parseDrySceneInteger(indexMd) != null &&
    factsCount == null &&
    facts?.passes === 3
  ) {
    warnings.push(
      "scenario-facts.json に dryOrgasmArrivals がありません（SRT照合後に件数リストを追記推奨）"
    );
  }

  return { errors, warnings };
}

export async function auditDryOrgasmForSlug(slug) {
  const reviewDir = path.join(REVIEW_ROOT, slug);
  let indexMd;
  try {
    indexMd = await readFile(path.join(reviewDir, "index.md"), "utf8");
  } catch {
    return { errors: ["index.md が見つかりません"], warnings: [] };
  }

  let facts = null;
  try {
    facts = JSON.parse(
      await readFile(path.join(reviewDir, "scenario-facts.json"), "utf8")
    );
  } catch {
    /* optional */
  }

  let analysisData = null;
  try {
    analysisData = JSON.parse(
      await readFile(path.join(reviewDir, "_分析データ.json"), "utf8")
    );
  } catch {
    /* optional */
  }

  return auditDryOrgasmCount({ indexMd, facts, analysisData });
}
