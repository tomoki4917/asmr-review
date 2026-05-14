/**
 * レビュー index.md から「誘導構成比」「誘導特性（/5）」を抽出し JSON 出力する。
 * 「初心者が催眠を体験しやすさ」の公式ランキングではなく、同一物差しの生データ＋任意ヒューリスティック用。
 *
 * Usage: node scripts/export-review-induction-metrics.mjs
 * Output: docs/review-induction-metrics.json（標準出力にも要約行）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const REVIEW_DIR = path.join(ROOT, "src", "content", "レビュー");

function readFmField(text, key) {
  const re = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const m = text.match(re);
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v || null;
}

function stripCell(s) {
  return s.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
}

function parseTableRows(block) {
  const rows = [];
  for (const line of block.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (/^\|\s*---/.test(line)) continue;
    if (/^\|\s*項目\s*\|/.test(line)) continue;
    if (/^\|\s*特性\s*\|/.test(line)) continue;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 4) continue;
    const label = parts[1];
    const mid = parts[2];
    rows.push({ label, mid });
  }
  return rows;
}

function parseInductionRatio(block) {
  const rows = parseTableRows(block);
  const out = {};
  let sum = 0;
  for (const { label, mid } of rows) {
    const n = Number.parseFloat(mid);
    if (Number.isNaN(n)) continue;
    const key = stripCell(label);
    out[key] = n;
    sum += n;
  }
  return { byLabel: out, sum };
}

function bucketInduction(byLabel) {
  let 論理性 = 0;
  let 強制力 = 0;
  let 突破力 = 0;
  let 浸透力 = 0;
  let 身体性 = 0;
  for (const [label, v] of Object.entries(byLabel)) {
    if (label.startsWith("論理性")) 論理性 += v;
    else if (label.startsWith("強制力")) 強制力 += v;
    else if (label.startsWith("突破力")) 突破力 += v;
    else if (label.startsWith("浸透力")) 浸透力 += v;
    else if (label.startsWith("身体性")) 身体性 += v;
  }
  return { 論理性, 強制力, 突破力, 浸透力, 身体性 };
}

function parseTraits(block) {
  const rows = parseTableRows(block);
  const traits = [];
  for (const { label, mid } of rows) {
    const m = mid.match(/(\d+(?:\.\d+)?)\s*\/\s*5/);
    if (!m) continue;
    traits.push({ name: stripCell(label), score: Number.parseFloat(m[1]) });
  }
  return traits;
}

function extractBetween(src, startMarker, endMarker) {
  const i0 = src.indexOf(startMarker);
  if (i0 === -1) return null;
  const i1 = src.indexOf(endMarker, i0 + startMarker.length);
  if (i1 === -1) return src.slice(i0);
  return src.slice(i0, i1);
}

function parseSensitivity(text) {
  const m = text.match(/###\s*【推奨感度Lv：(\d+)以上】/);
  return m ? Number.parseInt(m[1], 10) : null;
}

function hasShallowTranceNote(text) {
  const block = extractBetween(text, "## 解析結論", "## どんな人におすすめか") ?? "";
  return /浅いトランス/.test(block);
}

/**
 * 任意の「入りやすさ」近似: 論理・身体・浸透を足し、強制をやや減点。
 * 数値だけでは初心者体感を表せないため README 用コメント必須。
 */
function heuristicEntryEase(b) {
  return (
    b.論理性 +
    b.身体性 +
    b.浸透力 +
    0.35 * b.突破力 -
    0.65 * b.強制力
  );
}

function main() {
  const slugs = fs
    .readdirSync(REVIEW_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();

  const records = [];

  for (const slug of slugs) {
    const fp = path.join(REVIEW_DIR, slug, "index.md");
    if (!fs.existsSync(fp)) continue;
    const text = fs.readFileSync(fp, "utf8");
    const itemName = readFmField(text, "itemName") ?? readFmField(text, "title") ?? slug;

    const detail = extractBetween(
      text,
      "## 本作の誘導・暗示解析詳細",
      "## パート別解析"
    );
    if (!detail) {
      records.push({
        slug,
        itemName,
        hasInductionDetailSection: false,
      });
      continue;
    }

    const ratioBlock =
      extractBetween(detail, "### 誘導構成比", "### 本作で特に強い誘導特性") ?? "";
    const traitBlock =
      extractBetween(detail, "### 本作で特に強い誘導特性", "### 暗示構成比") ?? "";

    const ratio = parseInductionRatio(ratioBlock);
    const buckets = bucketInduction(ratio.byLabel);
    const traits = parseTraits(traitBlock);
    const traitScores = traits.map((t) => t.score);
    const traitAvg =
      traitScores.length === 0
        ? null
        : traitScores.reduce((a, b) => a + b, 0) / traitScores.length;
    const traitMax = traitScores.length === 0 ? null : Math.max(...traitScores);

    records.push({
      slug,
      itemName,
      hasInductionDetailSection: true,
      inductionRatioByLabel: ratio.byLabel,
      inductionRatioSum: Math.round(ratio.sum * 100) / 100,
      inductionBuckets: buckets,
      heuristicEntryEase: Math.round(heuristicEntryEase(buckets) * 100) / 100,
      inductionTraits: traits,
      inductionTraitAvg: traitAvg == null ? null : Math.round(traitAvg * 100) / 100,
      inductionTraitMax: traitMax,
      recommendedSensitivityMin: parseSensitivity(text),
      shallowTrancePossibleNote: hasShallowTranceNote(text),
    });
  }

  const withDetail = records.filter((r) => r.hasInductionDetailSection);
  const sortedHeuristic = [...withDetail].sort(
    (a, b) => b.heuristicEntryEase - a.heuristicEntryEase
  );

  const lv2Shallow = withDetail
    .filter(
      (r) =>
        r.recommendedSensitivityMin === 2 && r.shallowTrancePossibleNote === true
    )
    .sort((a, b) => b.heuristicEntryEase - a.heuristicEntryEase);

  const out = {
    generatedAt: new Date().toISOString(),
    description:
      "誘導構成比・誘導特性は index.md の表から機械抽出。heuristicEntryEase = 論理性+身体性+浸透力 + 0.35*突破力 - 0.65*強制力（任意の「入りやすさ」近似。公式の初心者指標ではない）。rankByHeuristicAmongLv2WithShallowNote は推奨感度Lv2かつ解析結論に「浅いトランス」を含む作品に限定した同ソート。誘導特性スコアは本文どおり「逃げにくさ／機構の強さ」寄りで、数値が高い＝初心者向きとは限らない。",
    countTotal: records.length,
    countWithInductionTables: withDetail.length,
    records,
    rankByHeuristicEntryEase: sortedHeuristic.map((r, i) => ({
      rank: i + 1,
      slug: r.slug,
      itemName: r.itemName,
      heuristicEntryEase: r.heuristicEntryEase,
      inductionTraitMax: r.inductionTraitMax,
      recommendedSensitivityMin: r.recommendedSensitivityMin,
      shallowTrancePossibleNote: r.shallowTrancePossibleNote,
    })),
    rankByHeuristicAmongLv2WithShallowNote: lv2Shallow.map((r, i) => ({
      rank: i + 1,
      slug: r.slug,
      itemName: r.itemName,
      heuristicEntryEase: r.heuristicEntryEase,
      inductionTraitMax: r.inductionTraitMax,
    })),
  };

  const outPath = path.join(ROOT, "docs", "review-induction-metrics.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log(`Wrote ${outPath}`);
  console.log(`With tables: ${withDetail.length} / ${records.length}`);
  console.log("Top 8 by heuristicEntryEase:");
  for (const row of out.rankByHeuristicEntryEase.slice(0, 8)) {
    console.log(
      `  ${row.rank}. ${row.itemName} | ease=${row.heuristicEntryEase} | traitMax=${row.inductionTraitMax} | Lv>=${row.recommendedSensitivityMin} | 浅い記述=${row.shallowTrancePossibleNote}`
    );
  }
}

main();
