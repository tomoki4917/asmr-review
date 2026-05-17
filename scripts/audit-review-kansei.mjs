#!/usr/bin/env node
/**
 * 完成系（正本 kuchikou + 真執筆ガイド）への移行状況を監査する。
 *
 * Usage:
 *   node scripts/audit-review-kansei.mjs           # 一覧
 *   node scripts/audit-review-kansei.mjs --next    # 未完了の先頭 slug のみ
 *   node scripts/audit-review-kansei.mjs --write-status
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const reviewsDir = path.join(repoRoot, "src", "content", "レビュー");
const pageTsx = path.join(repoRoot, "src", "app", "(public)", "reviews", "[slug]", "page.tsx");
const statusPath = path.join(repoRoot, "docs", "kansei-migration-status.md");

const args = new Set(process.argv.slice(2));
const flagNext = args.has("--next");
const flagWrite = args.has("--write-status");

const CHECKS = [
  {
    id: "cards",
    label: "感度Lvカードなし",
    fail: (t) => !t.includes("### 体験感度Lv（一覧）"),
  },
  {
    id: "osusume_h2",
    label: "旧 h2「どんな人」",
    fail: (t) => /##\s*どんな人/.test(t),
  },
  {
    id: "table_col",
    label: "表が「読者が得る体験」",
    fail: (t) => t.includes("読者が得る体験"),
  },
  {
    id: "souhyo_old",
    label: "旧総評見出し",
    fail: (t) => t.includes("### 【設計の論理的総括】"),
  },
  {
    id: "dry_old",
    label: "旧「ドライN回」表記",
    fail: (t) => /ドライ\d+回/.test(t) && !/ドライシーン/.test(t),
  },
  {
    id: "wet_old",
    label: "旧「ウェットN回」表記",
    fail: (t) => /ウェット\d+回/.test(t) && !/ウェットシーン/.test(t),
  },
  {
    id: "motion_tag",
    label: "HTML誤タグ </motion>",
    fail: (t) => t.includes("</motion>"),
  },
  {
    id: "triple_div",
    label: "感度カードの余分な </motion>",
    fail: (t) => /(<\/motion>\s*){3,}\s*<div class="review-sensitivity-lv-card"/.test(t),
  },
  {
    id: "dandori_osusume",
    label: "禁止見出し「段取り通りの催眠」",
    fail: (t) => /段取り通りの(?:催眠|宗眠)が好きな方/.test(t),
  },
];

async function loadQuickGuideSlugs() {
  try {
    const src = await readFile(pageTsx, "utf8");
    const slugs = [...src.matchAll(/^\s+"([a-z0-9-]+)":\s*\{/gm)].map((m) => m[1]);
    return new Set(slugs);
  } catch {
    return new Set();
  }
}

async function auditAll() {
  const entries = await readdir(reviewsDir, { withFileTypes: true });
  const slugs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "ja"));

  const quickGuide = await loadQuickGuideSlugs();
  const rows = [];

  for (const slug of slugs) {
    const indexPath = path.join(reviewsDir, slug, "index.md");
    let text;
    try {
      text = await readFile(indexPath, "utf8");
    } catch {
      continue;
    }

    const failed = CHECKS.filter((c) => c.fail(text));
    const noQuickGuide = quickGuide.size > 0 && !quickGuide.has(slug);

    rows.push({
      slug,
      title: (text.match(/^title:\s*(.+)$/m) || [])[1]?.trim() ?? slug,
      ok: failed.length === 0 && !noQuickGuide,
      failed,
      noQuickGuide,
    });
  }

  return rows;
}

function formatReport(rows) {
  const done = rows.filter((r) => r.ok);
  const pending = rows.filter((r) => !r.ok);

  const lines = [
    `# 完成系移行状況（自動生成）`,
    ``,
    `正本: \`kuchikou-saimin-count-trip-nouiki/index.md\` / \`docs/真催眠音声執筆ガイド.md\``,
    ``,
    `| 項目 | 件数 |`,
    `|------|------:|`,
    `| レビュー合計 | ${rows.length} |`,
    `| 完成系 OK | ${done.length} |`,
    `| 未完了 | ${pending.length} |`,
    ``,
  ];

  if (pending.length) {
    lines.push(`## 未完了（${pending.length}）`, ``);
    for (const r of pending) {
      const issues = [
        ...r.failed.map((f) => f.label),
        ...(r.noQuickGuide ? ["quickGuide 未登録"] : []),
      ];
      lines.push(`- **\`${r.slug}\`** — ${issues.join("、")}`);
    }
    lines.push(``);
  }

  if (done.length) {
    lines.push(`## 完了（${done.length}）`, ``);
    for (const r of done) {
      lines.push(`- \`${r.slug}\``);
    }
    lines.push(``);
  }

  lines.push(
    `---`,
    ``,
    `再生成: \`npm run review:audit-kansei -- --write-status\``,
    `次の1本: \`npm run review:audit-kansei -- --next\``,
  );

  return lines.join("\n");
}

function printConsole(rows) {
  const pending = rows.filter((r) => !r.ok);
  const done = rows.filter((r) => r.ok);

  console.log(`レビュー ${rows.length} 本 / 完成系 OK ${done.length} / 未完了 ${pending.length}\n`);

  if (pending.length) {
    console.log("--- 未完了 ---");
    for (const r of pending) {
      const issues = [
        ...r.failed.map((f) => f.id),
        ...(r.noQuickGuide ? ["no_quickguide"] : []),
      ];
      console.log(`  ${r.slug}  (${issues.join(", ")})`);
    }
    console.log("");
  }

  if (done.length) {
    console.log("--- 完了 ---");
    for (const r of done) {
      console.log(`  ${r.slug}`);
    }
  }
}

async function main() {
  const rows = await auditAll();
  const pending = rows.filter((r) => !r.ok);

  if (flagNext) {
    if (!pending.length) {
      console.log("ALL_DONE");
      process.exit(0);
    }
    console.log(pending[0].slug);
    process.exit(0);
  }

  if (flagWrite) {
    const md = formatReport(rows);
    await writeFile(statusPath, md, "utf8");
    console.log(`Wrote ${path.relative(repoRoot, statusPath)}`);
  }

  printConsole(rows);

  process.exit(pending.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
