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
import { extractDryWetCounts } from "./lib/extract-dry-wet-counts.mjs";

const repoRoot = process.cwd();
const reviewsDir = path.join(repoRoot, "src", "content", "レビュー");
const productsPath = path.join(repoRoot, "data", "products.json");
const pageTsx = path.join(repoRoot, "src", "app", "(public)", "reviews", "[slug]", "page.tsx");
const statusPath = path.join(repoRoot, "docs", "kansei-migration-status.md");

const args = new Set(process.argv.slice(2));
const flagNext = args.has("--next");
const flagWrite = args.has("--write-status");

function isDoujinReview(text) {
  return (
    /\n\s+-\s+同人音声\n/.test(text) ||
    /authorName:\s*同人音声レビュー室/.test(text)
  );
}

const CHECKS = [
  {
    id: "cards",
    label: "感度Lvカードなし",
    fail: (t) => !isDoujinReview(t) && !t.includes("### 体験感度Lv（一覧）"),
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
    id: "quick_wet_plural",
    label: "クイック: ウェットシーン複数回が欠落",
    fail: (t) => {
      if (!/ウェットシーン\s*複数回/.test(t)) return false;
      const out = extractDryWetCounts(t);
      return !out || !/ウェット/.test(out);
    },
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
  {
    id: "tai_part_zone",
    label: "禁止語「〜帯」（パート区間）",
    fail: (t) => hasForbiddenTaiPartZone(t),
  },
  {
    id: "tachiagari",
    label: "禁止語「立ち上が」系",
    fail: (t) => hasForbiddenTachiagari(t),
  },
  {
    id: "tsumi",
    label: "禁止語「積み」系",
    fail: (t) => hasForbiddenTsumi(t),
  },
  {
    id: "tachi_fragment",
    label: "禁止語「立ち」切れ（立つ欠落）",
    fail: (t) => hasForbiddenTachiFragment(t),
  },
  {
    id: "toriniikitai",
    label: "禁止見出し「取りにいきたい方」",
    fail: (t) => hasForbiddenToriniikitai(t),
  },
  {
    id: "doujin_subtrack_table",
    label: "同人: サブトラック明細表（パートの長さ）",
    fail: (t) => hasDoujinSubtrackTable(t),
  },
];

/** 収録パートを「帯」と呼ぶ用法のみ禁止（性感帯・肩甲帯・熱を帯び・時間帯・帯域は可） */
function hasForbiddenTaiPartZone(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const stripped = body
    .replace(/性感帯/g, "")
    .replace(/肩甲帯/g, "")
    .replace(/熱を帯び/g, "")
    .replace(/時間帯/g, "")
    .replace(/帯域/g, "");
  const partZonePrefix =
    "(?:快感|快楽|誘導|解除|エロ|深化|暗示|エッチ|本編|連続|巣穴|幻想|ピーク|実行|電車|屋外|密着|スイ|メロ|手コキ|中出し|購入特典|フェラ|R18|公開|催眠誘導|エロパート|ノーハンド|耳舐め|授乳|キス|歌唱|安眠|連続エロ|連続ドライ|心象|MC|密着|回収)";
  if (new RegExp(`${partZonePrefix}帯`).test(stripped)) return true;
  if (/帯が(?:採用|閉じ|確保|続き|主軸)/.test(stripped)) return true;
  if (/(?:帯より|帯だけ|帯末|帯中心|帯配分|帯幅)/.test(stripped)) return true;
  return false;
}

/** `立ち上がる` `立ち上がってきます` `立ち上がり` 等（§3h 項5）。台詞引用（> 行）は除外 */
function hasForbiddenTachiagari(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  return /立ち上が/.test(withoutQuotes);
}

/** `積み` `積み上げ` `積み上が` `積み重ね` 等（§1（補）・同人ガイド2）。台詞引用（> 行）は除外 */
function hasForbiddenTsumi(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  return /積み/.test(withoutQuotes);
}

/** `立つ` を `立ち` だけで済ませる切れ（§1（補）B-1）。台詞引用（> 行）は除外 */
function hasForbiddenTachiFragment(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  const stripped = withoutQuotes
    .replace(/立ち上が/g, "")
    .replace(/立ちやすい/g, "")
    .replace(/立ちにくい/g, "")
    .replace(/立ちリラックス/g, "")
    .replace(/立ち位置/g, "")
    .replace(/立ち姿勢/g, "")
    .replace(/立ち疲労/g, "")
    .replace(/立ち止/g, "")
    .replace(/立ち会/g, "")
    .replace(/立ち回/g, "")
    .replace(/立ち見/g, "")
    .replace(/粟立ち/g, "")
    .replace(/際立ち/g, "");
  return /(?:が|に)立ち[、。]/.test(stripped) || /(?:が|に)立ち\s/.test(stripped);
}

/** おすすめ／合わないの太字見出しで `取りにいきたい方`（§2.2・§2.3） */
function hasForbiddenToriniikitai(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const m = body.match(
    /\*\*おすすめしたい方\*\*[\s\S]*?(?=\n## |\n\*\*総合評価\*\*|\n---\s*$|$)/
  );
  if (!m) return false;
  return /取りに(?:い|行)きたい/.test(m[0]);
}

/** 同人：`### パートの長さ` 内のサブトラック明細表（DLsite 全行転記） */
function hasDoujinSubtrackTable(text) {
  if (!isDoujinReview(text)) return false;
  const m = text.match(/### パートの長さ[\s\S]*?(?=\n## |$)/);
  if (!m) return false;
  const section = m[0];
  if (/####\s/.test(section)) return true;
  if (/\| 0[0-9] \|/.test(section) && !/\| # \|/.test(section)) return true;
  return false;
}

function isDlsitePriceFetched(row) {
  const raw = String(row?.fetched_at ?? "").trim();
  if (!raw) return false;
  return !Number.isNaN(Date.parse(raw));
}

async function loadProductsById() {
  try {
    const raw = await readFile(productsPath, "utf8");
    const list = JSON.parse(raw);
    return new Map(
      (Array.isArray(list) ? list : []).map((r) => [
        String(r.id).toUpperCase(),
        r,
      ])
    );
  } catch {
    return new Map();
  }
}

async function loadQuickGuideSlugs() {
  const map = await loadQuickGuideInductionBySlug();
  return new Set(map.keys());
}

/** `quickGuideBySlug` 各 slug の `inductionType` 文字列 */
async function loadQuickGuideInductionBySlug() {
  try {
    const src = await readFile(pageTsx, "utf8");
    const map = new Map();
    const starts = [...src.matchAll(/^\s+"([a-z0-9-]+)":\s*\{/gm)];
    for (let i = 0; i < starts.length; i++) {
      const slug = starts[i][1];
      const start = starts[i].index;
      const end = i + 1 < starts.length ? starts[i + 1].index : src.length;
      const block = src.slice(start, end);
      const m = block.match(/inductionType:\s*\n?\s*"([^"]+)"/);
      if (m) map.set(slug, m[1]);
    }
    return map;
  } catch {
    return new Map();
  }
}

/** 誘導タイプにシチュラベルを入れない（ガイド §1（補）項4） */
function hasShituInInductionType(value) {
  return /シチュ(?:ボイス)?系|シチュエーション系/.test(value);
}

async function auditAll() {
  const entries = await readdir(reviewsDir, { withFileTypes: true });
  const slugs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "ja"));

  const quickGuide = await loadQuickGuideSlugs();
  const inductionBySlug = await loadQuickGuideInductionBySlug();
  const productsById = await loadProductsById();
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
    const inductionType = inductionBySlug.get(slug);
    const inductionShitu =
      !isDoujinReview(text) &&
      inductionType &&
      hasShituInInductionType(inductionType);

    const contentKind =
      (text.match(/^contentKind:\s*(.+)$/m) || [])[1]?.trim() || "review";
    const dlsiteId = (
      text.match(/^dlsiteProductId:\s*(?:"([^"]*)"|([^\n#]+))\s*$/m) || []
    )
      .slice(1)
      .find(Boolean)
      ?.trim()
      .replace(/^["']|["']$/g, "")
      .toUpperCase();
    let dlsitePriceIssue = "";
    if (contentKind !== "article" && dlsiteId) {
      const prod = productsById.get(dlsiteId);
      if (!prod) dlsitePriceIssue = "products.json 未登録";
      else if (!isDlsitePriceFetched(prod))
        dlsitePriceIssue = "DLsite 価格未取得";
    }

    rows.push({
      slug,
      title: (text.match(/^title:\s*(.+)$/m) || [])[1]?.trim() ?? slug,
      ok:
        failed.length === 0 &&
        !noQuickGuide &&
        !dlsitePriceIssue &&
        !inductionShitu,
      failed,
      noQuickGuide,
      inductionShitu: inductionShitu || undefined,
      dlsitePriceIssue: dlsitePriceIssue || undefined,
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
        ...(r.inductionShitu ? ["誘導タイプにシチュ系"] : []),
        ...(r.dlsitePriceIssue ? [r.dlsitePriceIssue] : []),
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
        ...(r.dlsitePriceIssue ? ["dlsite_price"] : []),
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
