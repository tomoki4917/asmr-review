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
import { auditGraphScores } from "./lib/audit-graph-scores.mjs";
import { auditReviewScenario } from "./lib/review-scenario-audit.mjs";

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
    /\n\s+-\s+全年齢同人\n/.test(text) ||
    /authorName:\s*同人音声レビュー室/.test(text)
  );
}

function isAllAgesDoujinReview(text) {
  return /\n\s+-\s+全年齢同人\n/.test(text);
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
    id: "shudai_line",
    label: "基本情報に「主題:」行（廃止・§1（補）E）",
    fail: (t) => /- \*\*主題[：:]\*\*/.test(t),
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
    id: "graph_sub_paren",
    label: "グラフ小見出しの括弧サブタイトル（入り（〜）等）",
    fail: (t) => hasForbiddenGraphSubParen(t),
  },
  {
    id: "chui_kotei",
    label: "禁止語「固定」系",
    fail: (t) => hasForbiddenKotei(t),
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
    id: "shin",
    label: "禁止語「芯」系（台詞引用除外）",
    fail: (t) => hasForbiddenShin(t),
  },
  {
    id: "tejun",
    label: "禁止語「手順」系（台詞引用除外）",
    fail: (t) => hasForbiddenTejun(t),
  },
  {
    id: "part_breakdown_dup",
    label: "パート別解析見出しの重複（§1 merge 再発防止）",
    fail: (t) => !isDoujinReview(t) && (t.match(/^## パート別解析\s*$/gm) || []).length > 1,
  },
  {
    id: "pleasure_urge_not_recommended",
    label: "合わない: 快感欲求ラベル（§0.3）",
    fail: (t) => hasForbiddenPleasureUrgeNotRecommended(t),
  },
  {
    id: "time_not_recommended",
    label: "合わない: 時間／尺理由（§0.3）",
    fail: (t) => hasForbiddenTimeNotRecommended(t),
  },
  {
    id: "mukinikui",
    label: "禁止語「向きにくい」系",
    fail: (t) => hasForbiddenMukinikui(t),
  },
  {
    id: "muki_masu",
    label: "禁止語「向きます」",
    fail: (t) => hasForbiddenMukiMasu(t),
  },
  {
    id: "listening_premise_line",
    label: "禁止: 総合評価直下の視聴前提一文",
    fail: (t) => hasForbiddenListeningPremiseLine(t),
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
    id: "hodoku",
    label: "禁止語「ほどく」系",
    fail: (t) => hasForbiddenHodoku(t),
  },
  {
    id: "kankei_no_dan",
    label: "禁止語「関係の段」系",
    fail: (t) => hasForbiddenKankeiNoDan(t),
  },
  {
    id: "dan_stage_phrase",
    label: "禁止語「段を進め／この段の」系",
    fail: (t) => hasForbiddenDanStagePhrase(t),
  },
  {
    id: "ondo_ga",
    label: "禁止語「温度が」",
    fail: (t) => hasForbiddenOndoGa(t),
  },
  {
    id: "bure_nikuku",
    label: "禁止語「ぶれにく」系",
    fail: (t) => hasForbiddenBureNikuku(t),
  },
  {
    id: "doujin_subtrack_table",
    label: "同人: サブトラック明細表（パートの長さ）",
    fail: (t) => hasDoujinSubtrackTable(t),
  },
  {
    id: "all_ages_no_taikan",
    label: "全年齢: パート解説に体感禁止",
    fail: (t) => isAllAgesDoujinReview(t) && /\*\*体感:\*\*/.test(t),
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

/** グラフ六小見出しの括弧サブタイトル（§1（補）項5・2026-05-23 廃止） */
function hasForbiddenGraphSubParen(text) {
  return /\*\*(入り|深さ|快感設計|絶頂シーン|着地|余韻)（/.test(text);
}

/** `固定`（§6・§7.1）。台詞引用（> 行）と表内 `【…固定…】` 特性ラベルは除外 */
function hasForbiddenKotei(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  const withoutBracketLabels = withoutQuotes.replace(/【[^】]*固定[^】]*】/g, "");
  return /固定/.test(withoutBracketLabels);
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

/** `芯` `この作品の芯` `快感の芯は` `芯だと感じ` 等（§7.1・review-prose-voice）。台詞引用（> 行）は除外 */
function hasForbiddenShin(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  return /芯/.test(withoutQuotes);
}

/** `手順` `手順どおり` `解除手順` 等（§7.1・review-prose-voice）。台詞引用（> 行）は除外 */
function hasForbiddenTejun(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  return /手順/.test(withoutQuotes);
}

/** `向きにくい` `向きにく` 等（§2.2・同人ガイド2）。台詞引用（> 行）は除外 */
function hasForbiddenMukinikui(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  return /向きにく/.test(withoutQuotes);
}

/** `向きます`（`向きにくい` は `mukinikui` で別検出）。台詞引用（> 行）は除外 */
function hasForbiddenMukiMasu(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  return /向きます/.test(withoutQuotes);
}

/** 総合評価直下の視聴前提宣言（同人ガイド2・評価時の視聴前提）。台詞引用（> 行）は除外 */
function hasForbiddenListeningPremiseLine(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  if (/静かな環境で(?:イヤホン|視聴)/.test(withoutQuotes)) return true;
  if (/イヤホン視聴した場合の評価/.test(withoutQuotes)) return true;
  if (/視聴する場合の評価です/.test(withoutQuotes)) return true;
  return false;
}

/** `ほどく` `ほどき` `ほどけ` `ほどか` 等（§1（補）B-0c・同人ガイド2）。台詞引用（> 行）は除外 */
function hasForbiddenHodoku(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  return /ほど[くけかき]/.test(withoutQuotes);
}

/** `関係の段ごと` `関係の段階` `関係の段差` 等（同人ガイド2）。台詞引用（> 行）は除外 */
function hasForbiddenKankeiNoDan(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  return /関係の段/.test(withoutQuotes);
}

/** `温度が`（関係・甘さの比喩。台詞引用（> 行）は除外） */
function hasForbiddenOndoGa(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  return /温度が/.test(withoutQuotes);
}

/** `ぶれにくく` `ぶれにくい` 等（台詞引用（> 行）は除外） */
function hasForbiddenBureNikuku(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  return /ぶれにく/.test(withoutQuotes);
}

/** `段を進め` `この段の` `段を上げ` 等（ゲーム／段階メタの「段」・階段は可）。台詞引用（> 行）は除外 */
function hasForbiddenDanStagePhrase(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  const withoutQuotes = body.replace(/^>.*$/gm, "");
  const stripped = withoutQuotes.replace(/階段/g, "");
  if (/段を進め/.test(stripped)) return true;
  if (/この段の/.test(stripped)) return true;
  if (/その段の/.test(stripped)) return true;
  if (/段を上げ/.test(stripped)) return true;
  return false;
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

/** 【合わない可能性がある人】で時間／尺を理由にする（§0.3） */
function hasForbiddenTimeNotRecommended(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  if (!body.includes("**【合わない可能性がある人】**")) return false;
  const section = body.split("**【合わない可能性がある人】**")[1];
  if (!section) return false;
  const block = section.split("\n\n---", 1)[0];
  const withoutQuotes = block.replace(/^>.*$/gm, "");
  const patterns = [
    /短時間で完結/,
    /短時間で終わ/,
    /長尺が苦手/,
    /時間がない方/,
    /要点だけ拾/,
    /本編だけでも1時間/,
  ];
  return patterns.some((re) => re.test(withoutQuotes));
}

/** 合わない欄でリスナーの快感欲求を理由にしない（催眠音声執筆ガイド §0.3） */
function hasForbiddenPleasureUrgeNotRecommended(text) {
  const body = text.replace(/^---[\s\S]*?---\n?/, "");
  if (!body.includes("**【合わない可能性がある人】**")) return false;
  const section = body.split("**【合わない可能性がある人】**")[1];
  if (!section) return false;
  const block = section.split("\n\n---", 1)[0];
  const withoutQuotes = block.replace(/^>.*$/gm, "");
  const patterns = [
    /すぐに快感を求め/,
    /快感を急い/,
    /すぐに絶頂へ/,
    /じれった/,
    /深化に時間をかけ/,
  ];
  return patterns.some((re) => re.test(withoutQuotes));
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
    const graphScores = await auditGraphScores(slug, text, reviewsDir);
    const scenario = await auditReviewScenario(slug);
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
        !inductionShitu &&
        graphScores.ok &&
        scenario.ok,
      failed,
      graphScoreErrors: graphScores.errors.length ? graphScores.errors : undefined,
      scenarioErrors: scenario.errors,
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
        ...(r.graphScoreErrors ?? []),
        ...(r.scenarioErrors ?? []).map((e) => `シナリオ: ${e}`),
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
        ...(r.graphScoreErrors?.length ? ["graph_scores"] : []),
        ...(r.scenarioErrors?.length ? ["scenario"] : []),
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
