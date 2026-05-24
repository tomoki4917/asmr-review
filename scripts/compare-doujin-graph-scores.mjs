#!/usr/bin/env node
/**
 * 同人十サブ代理採点の作品間比較
 *
 * Usage:
 *   node scripts/compare-doujin-graph-scores.mjs slug1 slug2 [slug3...]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (slugs.length < 2) {
  console.error("Usage: node scripts/compare-doujin-graph-scores.mjs slug1 slug2 ...");
  process.exit(1);
}

const reviewRoot = path.join(process.cwd(), "src", "content", "レビュー");
const SUB_KEYS = [
  "recording",
  "environment",
  "spatial",
  "distance",
  "reality",
  "inevitability",
  "acting",
  "tempo",
  "concept",
  "yoin",
];

const SUB_LABELS = {
  recording: "マイク・録音品質",
  environment: "環境音",
  spatial: "空間定位・音像",
  distance: "距離感・密着度",
  reality: "リアリティ",
  inevitability: "展開の必然性",
  acting: "演技力",
  tempo: "刺激のテンポ・緩急",
  concept: "コンセプトの達成度",
  yoin: "余韻の質",
};

async function loadScore(slug) {
  const p = path.join(reviewRoot, slug, "score-graph-features.auto.json");
  const raw = JSON.parse(await readFile(p, "utf8"));
  return { slug, ...raw };
}

const rows = await Promise.all(slugs.map(loadScore));

const lines = [];
lines.push(`# 同人十サブ代理採点比較`);
lines.push("");
lines.push(`生成: ${new Date().toISOString().slice(0, 10)} / v0.2-listen-free`);
lines.push("");

lines.push("| サブ | " + slugs.join(" | ") + " |");
lines.push("|------|" + slugs.map(() => "------").join("|") + "|");
for (const key of SUB_KEYS) {
  const cells = rows.map((r) => {
    const v = r.subScores?.[key];
    const c = r.confidence?.[key] ?? "?";
    return v != null ? `${v} (${c})` : "—";
  });
  lines.push(`| ${SUB_LABELS[key]} | ${cells.join(" | ")} |`);
}

lines.push("");
lines.push("## 五軸（代理平均）");
lines.push("");
lines.push("| 軸 | " + slugs.join(" | ") + " |");
lines.push("|----|" + slugs.map(() => "----").join("|") + "|");
for (const axis of ["scenario", "acoustic", "immersion", "pleasure", "satisfaction"]) {
  lines.push(`| ${axis} | ${rows.map((r) => r.axisScores?.[axis] ?? "—").join(" | ")} |`);
}

lines.push("");
lines.push("## Whisper 信頼度");
for (const r of rows) {
  lines.push(`- **${r.slug}** … ${r.whisperAudit?.global_reliability ?? r.features?.global?.whisper_reliability ?? "—"}`);
}

const outDir = path.join(process.cwd(), "docs", "compare");
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `doujin-graph-${slugs.join("-vs-")}.md`);
await writeFile(outPath, lines.join("\n") + "\n", "utf8");
console.log(lines.join("\n"));
console.log(`\nwrote: ${outPath}`);
