#!/usr/bin/env node
/**
 * レビュー index.md と analysis/*.txt のシナリオ矛盾を検出する。
 *
 * Usage:
 *   node scripts/audit-review-scenario.mjs              # 全 slug
 *   node scripts/audit-review-scenario.mjs <slug>         # 1 slug
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { auditReviewScenario } from "./lib/review-scenario-audit.mjs";

const repoRoot = process.cwd();
const reviewsDir = path.join(repoRoot, "src", "content", "レビュー");
const slugArg = process.argv[2];

async function listSlugs() {
  if (slugArg) return [slugArg];
  const entries = await readdir(reviewsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "ja"));
}

async function main() {
  const slugs = await listSlugs();
  let failed = 0;

  for (const slug of slugs) {
    const r = await auditReviewScenario(slug);
    if (r.errors.length) {
      failed++;
      console.log(`FAIL  ${slug}`);
      for (const e of r.errors) console.log(`  ✗ ${e}`);
    } else {
      console.log(`OK    ${slug}`);
    }
    for (const w of r.warnings) console.log(`  ⚠ ${w}`);
  }

  console.log(`\n${slugs.length - failed}/${slugs.length} OK`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
