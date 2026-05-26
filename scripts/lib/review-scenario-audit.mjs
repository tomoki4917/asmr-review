/**
 * レビュー index.md と analysis/*.txt の人物関係・役割矛盾を検出する。
 * 台本根拠なしの設定断定を公開前に止める（再発防止）。
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { auditDryOrgasmCount } from "./review-dry-orgasm-audit.mjs";

const REVIEW_ROOT = path.join(process.cwd(), "src", "content", "レビュー");

function isDoujinReview(text) {
  return (
    /\n\s+-\s+同人音声\n/.test(text) ||
    /\n\s+-\s+全年齢同人\n/.test(text) ||
    /authorName:\s*同人音声レビュー室/.test(text)
  );
}

/** analysis 全文から抽出したアンカー（小文字・正規化なし） */
export async function loadAnalysisCorpus(reviewDir) {
  const analysisDir = path.join(reviewDir, "analysis");
  let files;
  try {
    files = await readdir(analysisDir);
  } catch {
    return "";
  }
  const txts = files.filter((f) => f.endsWith(".txt") && !f.startsWith("info"));
  const parts = [];
  for (const name of txts.sort()) {
    parts.push(await readFile(path.join(analysisDir, name), "utf8"));
  }
  return parts.join("\n");
}

export function stripFrontmatterAndQuotes(md) {
  const body = md.replace(/^---[\s\S]*?---\n?/, "");
  return body.replace(/^>.*$/gm, "");
}

/**
 * 既知の誤読パターン（台詞アンカー ↔ 記事の矛盾）
 * @returns {{ id: string, label: string, fail: boolean }[]}
 */
export function auditScenarioContradictions(indexBody, analysisCorpus) {
  const prose = stripFrontmatterAndQuotes(indexBody);
  const checks = [];

  // 聴き手=後輩（男）なのに「後輩女子」と書く
  if (/後輩くん|見知らぬ後輩/.test(analysisCorpus)) {
    checks.push({
      id: "kohai_gender_swap",
      label: "聴き手は後輩（後輩くん）なのに記事で「後輩女子」等と書いている",
      fail: /後輩女子|後輩の女子|女子高生が.*後輩|後輩女子と.*主人/.test(prose),
    });
  }

  // プロローグ: 屋上で自殺するのが先輩側（不良少女）— 聴き手が止めに行く
  if (/私のこと止めに来たんでしょ|見知らぬ後輩くん/.test(analysisCorpus)) {
    checks.push({
      id: "rooftop_stopper_role",
      label: "プロローグの屋上: 止めるのは後輩のあなた（聴き手）— 先輩側が自殺未遂",
      fail: /自殺を図ろうとする後輩/.test(prose),
    });
  }

  // 屋上＝サボ・昼寝の場なのに「屋上で止めた／屋上で自殺を図り」と書く（shinitagari 型）
  if (/語源サボ|昼寝しようと思って|屋上えっと語源/.test(analysisCorpus)) {
    checks.push({
      id: "rooftop_not_rescue_scene",
      label:
        "屋上はサボ・昼寝の場（台本）。「屋上で楓を止めた」「屋上で自殺を図り」等の現場制止描写は誤り",
      fail:
        /屋上で楓を止|屋上で[^。\n]{0,20}自殺を図|屋上で[^。\n]{0,12}止めた|屋上で[^。\n]{0,12}制止する/.test(
          prose
        ),
    });
  }

  // scenario-facts.json の forbiddenMisreads
  return checks;
}

export async function loadScenarioFacts(reviewDir) {
  const p = path.join(reviewDir, "scenario-facts.json");
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
}

export async function auditReviewScenario(slug) {
  const reviewDir = path.join(REVIEW_ROOT, slug);
  const indexPath = path.join(reviewDir, "index.md");
  let indexMd;
  try {
    indexMd = await readFile(indexPath, "utf8");
  } catch {
    return { slug, ok: false, errors: ["index.md が見つかりません"], warnings: [] };
  }

  const corpus = await loadAnalysisCorpus(reviewDir);
  const prose = stripFrontmatterAndQuotes(indexMd);
  const errors = [];
  const warnings = [];

  if (!corpus.trim()) {
    warnings.push("analysis/*.txt が無いため台本照合をスキップしました");
  } else {
    for (const c of auditScenarioContradictions(indexMd, corpus)) {
      if (c.fail) errors.push(c.label);
    }
  }

  const facts = await loadScenarioFacts(reviewDir);
  if (facts?.forbiddenMisreads?.length) {
    for (const phrase of facts.forbiddenMisreads) {
      if (prose.includes(phrase)) {
        errors.push(`scenario-facts 禁止誤読: 「${phrase}」が index に残っています`);
      }
    }
  }

  if (facts && facts.passes != null && facts.passes < 3) {
    errors.push(
      `scenario-facts.passes=${facts.passes}（3パス照合未達。passes: 3 に更新するまで公開不可）`
    );
  }

  if (!facts && corpus.trim() && isDoujinReview(indexMd)) {
    errors.push(
      "scenario-facts.json 未作成（同人は台本照合の正本必須。3パス照合を完了してから執筆・公開）"
    );
  } else if (!facts && corpus.trim()) {
    warnings.push("scenario-facts.json 未作成（3パス照合の正本を推奨）");
  }

  let analysisData = null;
  try {
    analysisData = JSON.parse(
      await readFile(path.join(reviewDir, "_分析データ.json"), "utf8")
    );
  } catch {
    /* optional */
  }

  const dryAudit = auditDryOrgasmCount({
    indexMd,
    facts,
    analysisData,
  });
  errors.push(...dryAudit.errors);
  warnings.push(...dryAudit.warnings);

  return { slug, ok: errors.length === 0, errors, warnings };
}
