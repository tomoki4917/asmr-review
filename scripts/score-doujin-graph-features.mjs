#!/usr/bin/env node
/**
 * 同人十サブ代理採点 v0.2.2
 *
 * Usage:
 *   node scripts/score-doujin-graph-features.mjs <slug> [--update-analysis] [--apply-axis]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  extractFeatures,
  scoreSubAxes,
  axisFromSubs,
  auditAllWhisper,
  extractMetaFromIndexYaml,
  assessClipRecordingAdjust,
  proximityCloseSignature,
} from "./lib/doujin-graph-scoring.mjs";

const repoRoot = process.cwd();
const reviewRoot = path.join(repoRoot, "src", "content", "レビュー");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flagUpdate = process.argv.includes("--update-analysis");
const flagApplyAxis = process.argv.includes("--apply-axis");
const slug = args[0];

if (!slug) {
  console.error(
    "Usage: node scripts/score-doujin-graph-features.mjs <slug> [--update-analysis] [--apply-axis]"
  );
  process.exit(1);
}

function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  const tags = [...m[1].matchAll(/^\s+-\s+(.+)$/gm)].map((x) => x[1].trim());
  if (tags.length) fm.tags = tags;
  const itemDesc = m[1].match(/itemDescription:\s*\|\s*\n([\s\S]*?)(?=\n\w|\n---)/);
  if (itemDesc) fm.itemDescription = itemDesc[1].trim();
  return fm;
}

async function readJson(p) {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const reviewDir = path.join(reviewRoot, slug);
  const analysisDir = path.join(reviewDir, "analysis");

  const indexMd = await readFile(path.join(reviewDir, "index.md"), "utf8").catch(() => "");
  const fm = parseFrontmatter(indexMd);
  const meta = extractMetaFromIndexYaml(fm);

  const whisperAudit = await auditAllWhisper(analysisDir);
  await writeFile(
    path.join(analysisDir, "transcript-caveats.auto.json"),
    JSON.stringify(whisperAudit, null, 2) + "\n",
    "utf8"
  );

  const dlsiteTrends = await readJson(path.join(analysisDir, "dlsite_review_trends.auto.json"));
  const features = await extractFeatures(reviewDir, { meta, dlsiteTrends });
  const { subScores, confidence } = scoreSubAxes(features, dlsiteTrends);
  const axisScores = axisFromSubs(subScores);
  const clipAdj = assessClipRecordingAdjust(features.global, features.tracks);

  const lowConf = Object.entries(confidence)
    .filter(([, v]) => v === "low")
    .map(([k]) => k);

  const out = {
    version: "v0.2.2-listen-free",
    slug,
    computedAt: new Date().toISOString(),
    method:
      "Whisper監査＋文字起こし＋waveform＋spatial＋DLsite傾向＋indexメタからの代理採点。音声未聴取。公開確定値ではない。",
    subScores,
    axisScores,
    confidence,
    whisperAudit: {
      global_reliability: whisperAudit.global_reliability,
      recommendations: whisperAudit.recommendations,
    },
    evidence: {
      recording: `clip=${features.global.clip_ratio_mean}, sfx/min=${features.global.sfx_density_per_min}, clip_sfx_overlap=${features.global.clip_sfx_overlap_mean}, clip_mode=${clipAdj.mode}, snr_proxy=${features.global.snr_proxy_mean}, silence=${features.global.silence_ratio}`,
      environment: `non_speech=${features.global.non_speech_ratio_mean}, se_rms=${features.global.se_rms_mean}`,
      spatial: `pan_abs=${features.spatial?.pan_linear_mean_abs_mean}, pan_std=${features.spatial?.pan_linear_std_mean}`,
      distance: (() => {
        const prox = proximityCloseSignature(features.spatial);
        const lf = features.spatial?.lf_ratio_100_250hz_mean_of_track_means;
        const cent = features.spatial?.centroid_hz_mean_of_track_means;
        return `intimacy/min=${features.global.intimacy_density_per_min}, hf=${features.spatial?.hf_ratio_ge_4khz_mean_of_track_means}, lf=${lf}, cent=${cent}, prox=${prox.mode ?? "none"}`;
      })(),
      reality: `senpai/min=${features.global.senpai_ratio}, whisper_rel=${features.global.whisper_reliability}`,
      inevitability: `intimacy_mono=${features.global.intimacy_monotonic}, rms_mono=${features.global.rms_monotonic}`,
      acting: `emotion/min=${features.global.emotion_lex_density}, whisper_rel=${features.global.whisper_reliability}`,
      tempo: `surge/min=${features.global.surge_per_min}, rms_mono=${features.global.rms_monotonic}`,
      concept: `concept_hits=${features.global.concept_hit_tracks}/${features.tracks.length}, lex=${features.global.concept_lex_total}`,
      yoin: `sleep=${features.tracks.at(-1)?.duration_sec}s, tail_ratio=${features.tracks.at(-1)?.tail_rms_ratio}`,
    },
    features,
  };

  const outPath = path.join(reviewDir, "score-graph-features.auto.json");
  await writeFile(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`wrote: ${outPath}`);
  console.log("subScores:", subScores);
  console.log("axisScores:", axisScores);
  console.log("whisper global_reliability:", whisperAudit.global_reliability);
  if (lowConf.length) console.log("low confidence:", lowConf.join(", "));

  if (flagUpdate) {
    const analysisPath = path.join(reviewDir, "_分析データ.json");
    const obj = (await readJson(analysisPath)) ?? { schemaVersion: 2, scores: {}, notes: [] };
    obj.subScores = {
      scenario: { reality: subScores.reality, inevitability: subScores.inevitability },
      acoustic: { recording: subScores.recording, environment: subScores.environment },
      immersion: { spatial: subScores.spatial, distance: subScores.distance },
      pleasure: { acting: subScores.acting, tempo: subScores.tempo },
      satisfaction: { concept: subScores.concept, yoin: subScores.yoin },
    };
    obj.scoreMeta = {
      computedAt: out.computedAt,
      method: "score-doujin-graph-features.mjs v0.2.2",
      listenFree: true,
      confidence,
      whisperReliability: whisperAudit.global_reliability,
    };
    if (!Array.isArray(obj.notes)) obj.notes = [];
    obj.notes = obj.notes.filter(
      (n) => typeof n !== "string" || !n.startsWith("【十サブ代理採点")
    );
    obj.notes.push(
      `【十サブ代理採点 v0.2.2】${out.computedAt.slice(0, 10)} … rec=${subScores.recording} env=${subScores.environment} spatial=${subScores.spatial} dist=${subScores.distance} reality=${subScores.reality} inev=${subScores.inevitability} acting=${subScores.acting} tempo=${subScores.tempo} concept=${subScores.concept} yoin=${subScores.yoin}。Whisper信頼=${whisperAudit.global_reliability} clip=${clipAdj.mode}。低確信:${lowConf.join("/") || "なし"}。`
    );
    if (flagApplyAxis) {
      obj.scores = axisScores;
    }
    await writeFile(analysisPath, JSON.stringify(obj, null, 2) + "\n", "utf8");
    console.log(`updated: ${analysisPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
