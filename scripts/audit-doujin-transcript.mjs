#!/usr/bin/env node
/**
 * Whisper JSON 監査 → analysis/transcript-caveats.auto.json
 *
 * Usage:
 *   node scripts/audit-doujin-transcript.mjs <slug>
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { auditAllWhisper } from "./lib/doujin-graph-scoring.mjs";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/audit-doujin-transcript.mjs <slug>");
  process.exit(1);
}

const analysisDir = path.join(
  process.cwd(),
  "src",
  "content",
  "レビュー",
  slug,
  "analysis"
);

const out = await auditAllWhisper(analysisDir);
const outPath = path.join(analysisDir, "transcript-caveats.auto.json");
await writeFile(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`wrote: ${outPath}`);
console.log(`global_reliability: ${out.global_reliability}`);
if (out.recommendations.length) {
  console.log("recommendations:", out.recommendations.length);
}
