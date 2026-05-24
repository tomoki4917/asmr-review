/**
 * 同人グラフ十サブ：特徴量抽出・Whisper監査・代理採点（v0.2.2）
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const INTIMACY_LEX = [
  "先輩",
  "キス",
  "耳",
  "添い寝",
  "抱き枕",
  "好き",
  "甘",
  "密着",
  "ぎゅ",
  "恋人",
  "デート",
  "照れ",
  "からか",
  "ベロ",
  "ちゅ",
];

export const CONCEPT_LEX = [
  "抱き枕",
  "添い寝",
  "後輩",
  "密着",
  "恋人",
  "キス",
  "耳舐",
  "安眠",
  "眠",
  "告白",
  "ラブホ",
  "お泊",
];

export const EMOTION_LEX = ["照れ", "甘", "好き", "嬉し", "恥", "可愛い", "やん", "んっ", "はぁ"];

export const SE_HINT_LEX = ["水", "シャワ", "布", "擦", "湯", "泡", "足湯", "温泉"];

export const FILLER_RE = /^[はぁーあっうんッ…・\s]{2,}$/;

/** 近接・密着演出の息吹き／吸音／耳舐め系（Whisper 台詞内表記） */
export const PROXIMITY_SFX_LEX = [
  "ふぅ",
  "フュ",
  "はぁ",
  "ハァ",
  "はー",
  "んちゅ",
  "ちゅ",
  "チュ",
  "ちゅっ",
  "ぱちゅ",
  "じゅる",
  "ジュル",
  "レロ",
  "ぺろ",
  "ペロ",
  "べろ",
  "ぐちゅ",
  "ぐちょ",
  "ぬちゅ",
  "くちゅ",
  "ヌル",
  "ねちょ",
  "耳舐",
  "耳なめ",
  "舐め",
  "ズリュ",
];

export function clamp(n, lo = 0, hi = 10) {
  return Math.max(lo, Math.min(hi, Math.round(n * 10) / 10));
}

/**
 * 距離感・密着度用：高域囁き（HF）と低音近接（LF＋低centroid）の二系統。
 * 低音ボイス・近接効果では 4kHz+ が伸びず LF(100–250Hz) が跳ねるため HF 単独判定を避ける。
 */
export function proximityCloseSignature(spatial, trackCentroidHz = null, trackLfRatio = null) {
  const hf = spatial?.hf_ratio_ge_4khz_mean_of_track_means ?? 0;
  const lf =
    trackLfRatio ?? spatial?.lf_ratio_100_250hz_mean_of_track_means ?? 0;
  const cent =
    trackCentroidHz ?? spatial?.centroid_hz_mean_of_track_means ?? 4500;

  if (hf >= 0.2) return { hit: true, mode: "hf" };
  if (lf >= 0.1) return { hit: true, mode: "lf_strong" };
  if (lf >= 0.055 && cent <= 3200) return { hit: true, mode: "lf_low_centroid" };
  if (lf >= 0.045 && cent <= 2600) return { hit: true, mode: "lf_very_low_centroid" };
  return { hit: false, mode: null };
}

/** 終盤トラックの近接シグネチャ（高域寄り / 低音近接の両方） */
export function trackEndProximityBonus(track, spatialTrack = null) {
  const cent = track?.centroid_mean_hz ?? spatialTrack?.centroid_hz_mean ?? null;
  const lf = spatialTrack?.lf_ratio_100_250hz_mean ?? null;
  const hf = spatialTrack?.hf_ratio_ge_4khz_mean ?? null;
  if (cent == null) return false;
  if (cent > 4200) return true;
  if (hf != null && hf >= 0.2) return true;
  if (lf != null && lf >= 0.055 && cent <= 3200) return true;
  if (lf != null && lf >= 0.045 && cent <= 2600) return true;
  return false;
}

export function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export function pctl(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const k = (s.length - 1) * p;
  const i = Math.floor(k);
  const j = Math.min(i + 1, s.length - 1);
  return s[i] * (1 - (k - i)) + s[j] * (k - i);
}

export function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

export function monotonicRatio(values, tolerance = 0.82) {
  if (values.length < 2) return 0;
  let ok = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] >= values[i - 1] * tolerance) ok++;
  }
  return ok / (values.length - 1);
}

export function countLex(text, lex) {
  const hits = {};
  let total = 0;
  for (const w of lex) {
    const n = (text.match(new RegExp(w, "g")) || []).length;
    hits[w] = n;
    total += n;
  }
  return { hits, total };
}

function timeInSfxSegment(entries, t, lex) {
  return entries.some(
    (e) => t >= e.st && t < e.en && lex.some((w) => e.tx.includes(w))
  );
}

/** クリップ相当フレームのうち、SFX 語を含む SRT 区間と重なる割合 */
export function clipSfxOverlapRatio(entries, wf, lex = PROXIMITY_SFX_LEX, clipThresholdRatio = 0.98) {
  if (!wf.rms.length) return { clipTotal: 0, clipInSfx: 0, ratio: 0 };
  const maxR = Math.max(...wf.rms, 1e-9);
  const threshold = maxR * clipThresholdRatio;
  const hop = 0.1;
  let clipTotal = 0;
  let clipInSfx = 0;
  for (let i = 0; i < wf.rms.length; i++) {
    if (wf.rms[i] <= threshold) continue;
    clipTotal++;
    const t = i * hop;
    if (timeInSfxSegment(entries, t, lex)) clipInSfx++;
  }
  return {
    clipTotal,
    clipInSfx,
    ratio: clipTotal ? clipInSfx / clipTotal : 0,
  };
}

/**
 * クリップ減点の免除／近接演出加点（v0.2.2）
 * clip_ratio_mean > 0.015 のとき、SFX 高密度または clip↔SFX 時間重なりが高い場合は
 * 「ノイズ」ではなく近接過負荷（仕様）として -1.5 を無効化し、条件次第で小幅加点。
 */
export function assessClipRecordingAdjust(g, tracks) {
  const clip = g.clip_ratio_mean ?? 0;
  const sfxDen = g.sfx_density_per_min ?? 0;
  const overlap = g.clip_sfx_overlap_mean ?? 0;

  if (clip <= 0.015) {
    return { penalty: 0, bonus: 0, mode: "normal", exempt: false };
  }

  if (clip > 0.05 && sfxDen < 0.4 && overlap < 0.35) {
    return { penalty: -1.5, bonus: 0, mode: "clip_severe_noise", exempt: false };
  }

  const highClipTracks = tracks.filter((t) => (t.clip_ratio ?? 0) > 0.012);
  const trackSfxCover =
    highClipTracks.length === 0 ||
    highClipTracks.every(
      (t) =>
        (t.sfx_hits?.total ?? 0) >= 1 || (t.clip_sfx_overlap_ratio ?? 0) >= 0.4
    );

  const exempt =
    overlap >= 0.5 || sfxDen >= 0.8 || (trackSfxCover && sfxDen >= 0.45);

  if (exempt) {
    const bonus = sfxDen >= 1.2 || overlap >= 0.65 ? 0.35 : 0;
    return {
      penalty: 0,
      bonus,
      mode: bonus ? "clip_proximity_sfx_bonus" : "clip_proximity_sfx_exempt",
      exempt: true,
    };
  }

  return { penalty: -1.5, bonus: 0, mode: "clip_noise", exempt: false };
}

export function parseSrt(text) {
  const blocks = text.trim().split(/\n\s*\n/);
  const entries = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;
    const m = lines[1].match(
      /(\d\d):(\d\d):(\d\d),(\d\d\d)\s+-->\s+(\d\d):(\d\d):(\d\d),(\d\d\d)/
    );
    if (!m) continue;
    const st = +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
    const en = +m[5] * 3600 + +m[6] * 60 + +m[7] + +m[8] / 1000;
    const tx = lines.slice(2).join(" ").trim();
    entries.push({ st, en, tx, dur: en - st });
  }
  return entries;
}

export async function readWaveform(csvPath) {
  const text = await readFile(csvPath, "utf8");
  const lines = text.trim().split("\n").slice(1);
  const rms = [];
  const centroid = [];
  for (const line of lines) {
    const [, r, c] = line.split(",");
    const rv = parseFloat(r);
    const cv = parseFloat(c);
    if (!Number.isNaN(rv)) rms.push(rv);
    if (!Number.isNaN(cv)) centroid.push(cv);
  }
  return { rms, centroid };
}

export function auditWhisperJson(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  const segments = data?.segments ?? [];
  let lowConf = 0;
  let filler = 0;
  let totalWords = 0;
  let lowWordSum = 0;
  const flagged = [];

  for (const seg of segments) {
    const words = seg.words ?? [];
    const scores = words.map((w) => w.score).filter((s) => typeof s === "number");
    const segMean = scores.length ? mean(scores) : null;
    const text = (seg.text ?? "").trim();
    if (scores.length) {
      totalWords += scores.length;
      lowWordSum += scores.filter((s) => s < 0.35).length;
    }
    if (segMean != null && segMean < 0.35) {
      lowConf++;
      if (flagged.length < 8) {
        flagged.push({ start: seg.start, end: seg.end, text: text.slice(0, 40), meanScore: round3(segMean) });
      }
    }
    if (FILLER_RE.test(text) || (text.length <= 4 && /[はぁあっ]/.test(text))) {
      filler++;
    }
  }

  return {
    segment_count: segments.length,
    low_confidence_segments: lowConf,
    filler_segments: filler,
    low_word_ratio: totalWords ? round3(lowWordSum / totalWords) : null,
    reliability: segments.length
      ? clamp(10 - lowConf / Math.max(segments.length, 1) * 15 - (lowWordSum / Math.max(totalWords, 1)) * 3, 0, 10)
      : 0,
    flagged_samples: flagged,
  };
}

export async function loadCaveats(analysisDir) {
  const manualPath = path.join(analysisDir, "transcript-caveats.json");
  const autoPath = path.join(analysisDir, "transcript-caveats.auto.json");
  let manual = null;
  let auto = null;
  try {
    manual = JSON.parse(await readFile(manualPath, "utf8"));
  } catch {
    /* optional */
  }
  try {
    auto = JSON.parse(await readFile(autoPath, "utf8"));
  } catch {
    /* optional */
  }
  return { manual, auto };
}

export function buildConceptLexFromMeta(meta) {
  const base = [...CONCEPT_LEX];
  const extra = meta?.conceptKeywords ?? [];
  for (const w of extra) {
    if (w && !base.includes(w)) base.push(w);
  }
  return base;
}

export function extractMetaFromIndexYaml(fm) {
  const text = [fm.itemName, fm.itemDescription, fm.title, ...(fm.tags ?? [])].filter(Boolean).join("\n");
  const conceptKeywords = [];
  for (const w of CONCEPT_LEX) {
    if (text.includes(w)) conceptKeywords.push(w);
  }
  if (/イチャ|あまあま|純愛/.test(text)) conceptKeywords.push("イチャラブ");
  if (/温泉|足湯|道草屋/.test(text)) {
    conceptKeywords.push("温泉", "足湯", "ポキポキ", "道草屋");
  }
  return { conceptKeywords: [...new Set(conceptKeywords)], sourceText: text.slice(0, 500) };
}

function speechWindowsFromSrt(entries, hop = 0.1) {
  const windows = new Set();
  for (const e of entries) {
    for (let t = Math.floor(e.st / hop) * hop; t < e.en; t += hop) {
      windows.add(round1(t));
    }
  }
  return windows;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
function round3(n) {
  return Math.round(n * 1000) / 1000;
}
function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

export async function extractFeatures(reviewDir, options = {}) {
  const analysisDir = path.join(reviewDir, "analysis");
  const derived = options.derived ?? (await readJson(path.join(reviewDir, "derived_metrics.json"))) ?? {};
  const spatial = options.spatial ?? (await readJson(path.join(reviewDir, "spatial_spectral.auto.json")));
  const dlsiteTrends =
    options.dlsiteTrends ?? (await readJson(path.join(analysisDir, "dlsite_review_trends.auto.json")));
  const meta = options.meta ?? {};
  const conceptLex = buildConceptLexFromMeta(meta);
  const { manual: caveatsManual, auto: caveatsAuto } = await loadCaveats(analysisDir);

  const files = await readdir(analysisDir);
  const srtFiles = files.filter((f) => f.endsWith(".srt")).sort();
  const tracks = [];
  const whisperAudits = [];

  for (const srtName of srtFiles) {
    const base = srtName.replace(/\.srt$/, "");
    const jsonName = files.find((f) => f.startsWith(base) && f.endsWith(".json") && !f.includes("caveats"));
    let whisperAudit = null;
    if (jsonName) {
      try {
        whisperAudit = auditWhisperJson(await readFile(path.join(analysisDir, jsonName), "utf8"));
        whisperAudits.push({ track: base, ...whisperAudit });
      } catch {
        /* skip */
      }
    }

    const entries = parseSrt(await readFile(path.join(analysisDir, srtName), "utf8"));
    let reliableText = entries.map((e) => e.tx).join("");
    if (whisperAudit && whisperAudit.low_word_ratio > 0.35) {
      reliableText = entries
        .filter((_, i) => !whisperAudit.flagged_samples.some((f) => Math.abs(f.start - entries[i]?.st) < 1))
        .map((e) => e.tx)
        .join("");
    }

    const intimacy_hits = countLex(reliableText, INTIMACY_LEX);
    const concept_hits = countLex(reliableText, conceptLex);
    const emotion_hits = countLex(reliableText, EMOTION_LEX);
    const se_hits = countLex(reliableText, SE_HINT_LEX);
    const sfx_hits = countLex(reliableText, PROXIMITY_SFX_LEX);
    const senpai = (reliableText.match(/先輩/g) || []).length;

    const wfName = files.find((f) => f.startsWith(base) && f.endsWith("_waveform.csv"));
    let wf = { rms: [], centroid: [] };
    if (wfName) wf = await readWaveform(path.join(analysisDir, wfName));

    const duration = wf.rms.length ? wf.rms.length * 0.1 : entries.reduce((s, e) => s + e.dur, 0);
    const speechWindows = speechWindowsFromSrt(entries);
    let speechRms = [];
    let seRms = [];
    let silenceRms = [];
    const hop = 0.1;
    for (let i = 0; i < wf.rms.length; i++) {
      const t = round1(i * hop);
      const r = wf.rms[i];
      if (speechWindows.has(t)) speechRms.push(r);
      else if (r >= 0.002) seRms.push(r);
      else silenceRms.push(r);
    }

    const rmsP95 = pctl(wf.rms, 0.95);
    const rmsP50 = pctl(wf.rms, 0.5);
    const maxR = Math.max(...wf.rms, 1e-9);
    const clipRatio = wf.rms.filter((x) => x > maxR * 0.98).length / Math.max(wf.rms.length, 1);
    const clipSfx = clipSfxOverlapRatio(entries, wf);
    const tailStart = Math.floor(wf.rms.length * 0.85);
    const headEnd = Math.floor(wf.rms.length * 0.15);
    const tailRms = mean(wf.rms.slice(tailStart));
    const headRms = mean(wf.rms.slice(0, headEnd));
    const midRms = mean(wf.rms.slice(Math.floor(wf.rms.length * 0.4), Math.floor(wf.rms.length * 0.6)));

    const spTrack =
      spatial?.tracks?.find((t) => base.slice(0, 14) && t.file?.includes(base.slice(0, 14))) ??
      spatial?.tracks?.[tracks.length];

    const is_sleep = /安眠|入眠|眠/.test(base);
    const speechDur = entries.reduce((s, e) => s + e.dur, 0);
    const snrProxy =
      speechRms.length && silenceRms.length
        ? round3(mean(speechRms) / Math.max(mean(silenceRms), 1e-9))
        : null;

    tracks.push({
      name: base,
      duration_sec: round3(duration),
      speech_sec: round3(speechDur),
      non_speech_ratio: duration ? round3(1 - speechDur / duration) : 0,
      se_rms_mean: round6(mean(seRms)),
      speech_rms_mean: round6(mean(speechRms)),
      snr_proxy: snrProxy,
      intimacy_hits,
      concept_hits,
      emotion_hits,
      se_hits,
      sfx_hits,
      senpai_count: senpai,
      rms_mean: round6(mean(wf.rms)),
      rms_p50: round6(rmsP50),
      rms_p95: round6(rmsP95),
      clip_ratio: round6(clipRatio),
      clip_sfx_overlap_ratio: round6(clipSfx.ratio),
      clip_sfx_frames: clipSfx.clipTotal,
      centroid_mean_hz: round2(mean(wf.centroid.filter((c) => c > 0))),
      tail_rms_ratio: midRms ? round3(tailRms / midRms) : 1,
      head_to_tail_rms: headRms ? round3(tailRms / headRms) : 1,
      pan_mean_abs: spTrack?.pan_linear_mean_abs ?? null,
      pan_std: spTrack?.pan_linear_std ?? null,
      lf_ratio_100_250hz_mean: spTrack?.lf_ratio_100_250hz_mean ?? null,
      hf_ratio_ge_4khz_mean: spTrack?.hf_ratio_ge_4khz_mean ?? null,
      whisper: whisperAudit,
      is_sleep,
      dialogue_segments: entries.length,
    });
  }

  const fullDur = tracks.reduce((s, t) => s + t.duration_sec, 0);
  const fullSpeech = tracks.reduce((s, t) => t.speech_sec, 0);
  const mainTracks = tracks.filter((t) => !t.is_sleep);

  const intimacyProg = mainTracks.map(
    (t) => t.intimacy_hits.total / Math.max(t.duration_sec / 60, 0.1)
  );
  const rmsProg = mainTracks.map((t) => t.rms_p95);
  const whisperReliability = mean(whisperAudits.map((w) => w.reliability).filter(Boolean));

  const global = {
    duration_sec: round3(fullDur),
    speech_sec: round3(fullSpeech),
    silence_ratio: derived.silence_ratio_rms_lt_0_002 ?? null,
    rms_mean: derived.rms_mean ?? null,
    rms_cv: derived.rms_mean ? (derived.rms_std ?? 0) / derived.rms_mean : null,
    surge_per_min: derived.surge_events_per_min_rms_gt_p95 ?? null,
    centroid_mean_hz: derived.centroid_mean_hz ?? null,
    centroid_std_hz: derived.centroid_std_hz ?? null,
    clip_ratio_mean: round6(mean(tracks.map((t) => t.clip_ratio))),
    clip_sfx_overlap_mean: round6(
      mean(tracks.map((t) => t.clip_sfx_overlap_ratio).filter((x) => x != null))
    ),
    sfx_density_per_min: round3(
      tracks.reduce((s, t) => s + (t.sfx_hits?.total ?? 0), 0) / Math.max(fullDur / 60, 0.1)
    ),
    snr_proxy_mean: round3(mean(tracks.map((t) => t.snr_proxy).filter(Boolean))),
    non_speech_ratio_mean: round3(mean(tracks.map((t) => t.non_speech_ratio))),
    se_rms_mean: round6(mean(tracks.map((t) => t.se_rms_mean).filter(Boolean))),
    intimacy_density_per_min: round3(
      tracks.reduce((s, t) => s + t.intimacy_hits.total, 0) / (fullDur / 60)
    ),
    senpai_ratio: round3(
      tracks.reduce((s, t) => t.senpai_count, 0) / Math.max(fullSpeech / 60, 0.1)
    ),
    concept_lex_total: tracks.reduce((s, t) => s + t.concept_hits.total, 0),
    concept_hit_tracks: tracks.filter((t) => t.concept_hits.total >= 2).length,
    emotion_lex_density: round3(
      tracks.reduce((s, t) => s + t.emotion_hits.total, 0) / (fullDur / 60)
    ),
    intimacy_monotonic: round3(monotonicRatio(intimacyProg)),
    rms_monotonic: round3(monotonicRatio(rmsProg)),
    whisper_reliability: round3(whisperReliability),
    dlsite_review_count: dlsiteTrends?.total ?? 0,
  };

  return {
    tracks,
    global,
    spatial: spatial?.aggregate ?? null,
    spatialTracks: spatial?.tracks ?? [],
    whisperAudits,
    caveats: { manual: caveatsManual, auto: caveatsAuto },
    meta,
    conceptLex,
  };
}

async function readJson(p) {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return null;
  }
}

export function scoreSubAxes(features, dlsiteTrends = null) {
  const g = features.global;
  const tracks = features.tracks;
  const main = tracks.filter((t) => !t.is_sleep);
  const last = tracks[tracks.length - 1];

  // マイク・録音品質
  let recording = 7;
  if (g.silence_ratio >= 0.35 && g.silence_ratio <= 0.62) recording += 0.7;
  if (g.clip_ratio_mean < 0.006) recording += 0.9;
  if (g.snr_proxy_mean >= 8) recording += 0.6;
  if (g.rms_cv != null && g.rms_cv < 2.3) recording += 0.4;
  const clipAdj = assessClipRecordingAdjust(g, tracks);
  recording += clipAdj.penalty + clipAdj.bonus;

  // 環境音
  let environment = 6.8;
  const ns = g.non_speech_ratio_mean;
  if (ns >= 0.28 && ns <= 0.52) environment += 0.9;
  if (g.se_rms_mean > 0.001 && g.se_rms_mean < g.rms_mean * 2.5) environment += 0.6;
  if (g.centroid_std_hz > 2200) environment += 0.5;
  if (tracks.some((t) => t.se_hits.total >= 2)) environment += 0.4;

  // 空間定位
  let spatial = 6.5;
  const panAbs = features.spatial?.pan_linear_mean_abs_mean ?? 0;
  const panStd = features.spatial?.pan_linear_std_mean ?? 0;
  const relaxedPan = (features.meta?.conceptKeywords ?? []).some((w) =>
    /温泉|足湯|道草屋|宿/.test(w)
  );
  const panAbsMin = relaxedPan ? 0.2 : 0.32;
  const panStdMin = relaxedPan ? 0.28 : 0.42;
  if (panAbs >= panAbsMin) spatial += relaxedPan ? 0.9 : 1.1;
  if (panStd >= panStdMin && panStd <= 0.78) spatial += 1;
  if (std(main.map((t) => t.pan_mean_abs ?? 0)) < 0.22) spatial += 0.4;

  // 距離感（HF 高域囁き ＋ LF 近接効果・低音ボイス）
  let distance = 7;
  if (g.intimacy_density_per_min >= 0.9) distance += 0.9;
  if (g.intimacy_density_per_min >= 1.5) distance += 0.5;
  const proxGlobal = proximityCloseSignature(features.spatial);
  if (proxGlobal.hit) distance += 0.4;
  const lastSp =
    features.spatialTracks?.find(
      (t) => last?.name && t.file?.includes(last.name.slice(0, 14))
    ) ?? features.spatialTracks?.[tracks.length - 1];
  if (trackEndProximityBonus(last, lastSp)) distance += 0.4;
  if (g.senpai_ratio >= 1) distance += 0.3;

  // リアリティ
  let reality = 7.2;
  if (g.senpai_ratio >= 0.5) reality += 0.7;
  if (tracks.filter((t) => t.intimacy_hits.total > 0).length >= tracks.length - 1) reality += 0.6;
  if (g.whisper_reliability >= 7) reality += 0.5;

  // 展開の必然性
  let inevitability = 7;
  if (g.intimacy_monotonic >= 0.65) inevitability += 1.2;
  if (g.rms_monotonic >= 0.5) inevitability += 0.6;
  if (main.length >= 4) inevitability += 0.3;

  // 演技力
  let acting = 6.8;
  if (g.emotion_lex_density >= 0.5) acting += 1;
  if (g.emotion_lex_density >= 1.2) acting += 0.5;
  if (dlsiteTrends?.recurringThemes?.some((t) => /演技|声|可愛|からか/.test(t.label))) acting += 0.5;
  if (g.whisper_reliability >= 7.5) acting += 0.3;

  // テンポ
  let tempo = 7;
  const peaks = main.map((t) => t.rms_p95);
  if (peaks.length >= 3 && Math.max(...peaks) - Math.min(...peaks) > 0.008) tempo += 0.9;
  if (g.rms_monotonic >= 0.45) tempo += 0.5;
  if (g.surge_per_min >= 18 && g.surge_per_min <= 48) tempo += 0.4;

  // コンセプト
  let concept = 7;
  const hitRate = g.concept_hit_tracks / tracks.length;
  if (hitRate >= 0.75) concept += 1.2;
  if (g.concept_lex_total >= 18) concept += 0.6;
  if (features.meta?.conceptKeywords?.length >= 4) concept += 0.4;

  // 余韻
  let yoin = 6.8;
  if (last?.is_sleep && last.duration_sec >= 1500) yoin += 1;
  if (last && last.tail_rms_ratio < 0.75) yoin += 0.7;
  if (last && last.head_to_tail_rms < 0.9) yoin += 0.4;
  if (last?.intimacy_hits.hits["キス"] >= 1 || last?.intimacy_hits.hits["ちゅ"] >= 1) yoin += 0.4;
  if (dlsiteTrends?.recurringThemes?.some((t) => /安眠|添い寝|余韻/.test(t.label))) yoin += 0.3;

  const subScores = {
    recording: clamp(recording),
    environment: clamp(environment),
    spatial: clamp(spatial),
    distance: clamp(distance),
    reality: clamp(reality),
    inevitability: clamp(inevitability),
    acting: clamp(acting),
    tempo: clamp(tempo),
    concept: clamp(concept),
    yoin: clamp(yoin),
  };

  const confidence = {
    recording: g.snr_proxy_mean != null ? "medium" : "low",
    environment: g.se_rms_mean > 0 ? "medium" : "low",
    spatial: features.spatial ? "medium" : "low",
    distance: g.whisper_reliability >= 6 ? "medium" : "low",
    reality: g.whisper_reliability >= 6 ? "medium" : "low",
    inevitability: main.length >= 3 ? "medium" : "low",
    acting: g.whisper_reliability >= 7 ? "medium" : "low",
    tempo: peaks.length >= 3 ? "medium" : "low",
    concept: features.meta?.conceptKeywords?.length ? "medium" : "low",
    yoin: last?.is_sleep ? "medium" : "low",
  };

  return { subScores, confidence };
}

export function axisFromSubs(subScores) {
  return {
    scenario: clamp((subScores.reality + subScores.inevitability) / 2),
    acoustic: clamp((subScores.recording + subScores.environment) / 2),
    immersion: clamp((subScores.spatial + subScores.distance) / 2),
    pleasure: clamp((subScores.acting + subScores.tempo) / 2),
    satisfaction: clamp((subScores.concept + subScores.yoin) / 2),
  };
}

export async function auditAllWhisper(analysisDir) {
  const files = await readdir(analysisDir);
  const jsonFiles = files.filter(
    (f) => f.endsWith(".json") && !f.includes("caveats") && !f.includes("dlsite")
  );
  const tracks = [];
  for (const jf of jsonFiles.sort()) {
    try {
      const audit = auditWhisperJson(await readFile(path.join(analysisDir, jf), "utf8"));
      tracks.push({ file: jf.replace(/\.json$/, ""), ...audit });
    } catch {
      /* skip */
    }
  }
  const recommendations = [];
  for (const t of tracks) {
    if (t.low_confidence_segments / Math.max(t.segment_count, 1) > 0.25) {
      recommendations.push({
        track: t.file,
        action: "ignore_lexicon_partial",
        reason: `低信頼セグメント ${t.low_confidence_segments}/${t.segment_count}`,
      });
    }
    if (t.filler_segments / Math.max(t.segment_count, 1) > 0.15) {
      recommendations.push({
        track: t.file,
        action: "se_hallucination_suspect",
        reason: `フィラー/息のみセグメント ${t.filler_segments}件`,
      });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    tracks,
    recommendations,
    global_reliability: round3(mean(tracks.map((t) => t.reliability))),
  };
}

export { round3, round6, round2 };
