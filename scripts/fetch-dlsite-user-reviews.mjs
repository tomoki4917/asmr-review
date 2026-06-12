/**
 * DLsite 購入者レビュー（文章のみ）を取得し、温度感メモ用の傾向を機械抽出する。
 * index 本文・グラフ・総評・おすすめへ内容反映は禁止（docs/催眠音声執筆ガイド.md §8.4.3）。
 *
 * 使い方:
 *   node scripts/fetch-dlsite-user-reviews.mjs RJ01531480
 *   node scripts/fetch-dlsite-user-reviews.mjs RJ01531480 dakimakura-kanojo-pretty-holic-yurukawa-kouhai --update-notes
 *
 * 出力（slug 指定時）:
 *   src/content/レビュー/<slug>/analysis/dlsite_reviews.auto.json
 *   src/content/レビュー/<slug>/analysis/dlsite_review_trends.auto.json
 *
 * rate_num／星は参照しない。review_title + review_text のみ。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const REVIEW_ROOT = path.join(ROOT, "src", "content", "レビュー");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

const API = "https://www.dlsite.com/maniax/api/review";
const PAGE_LIMIT = 50;

/** 購入者レビュー本文で繰り返し拾うテーマ（星は使わない） */
const TEXT_THEMES = {
  "イチャラブ・あまあま": ["イチャラブ", "あまあま", "ラブラブ", "糖度", "純愛", "甘い", "甘"],
  "ディープキス・ベロチュー": ["ディープキス", "ベロチュー", "舌吻", "キス"],
  "耳舐め": ["耳舐め", "耳舐", "舔耳"],
  "小悪魔・からかい": ["小悪魔", "からかい", "调戏", "悪魔"],
  "添い寝・安眠": ["添い寝", "安眠", "寝落ち", "癒", "睡眠"],
  "お泊まり・連戦": ["お泊", "連戦", "回戦", "抜かず", "三発"],
  "肯定感・独り占め": ["肯定", "独占", "独り占め", "好き好き"],
  "密着・耳元": ["密着", "耳元", "超密着", "スキンシップ"],
  "穏やか・オホ声なし": ["オホ声", "激しめ", "穏やか", "愛が溢"],
  "抱き枕・後輩": ["抱き枕", "後輩", "先輩"],
};

const AXIS_HINTS = {
  scenario: ["シナリオ", "ストーリー", "展開", "一本道", "関係", "恋人", "後輩", "設定", "純愛"],
  acoustic: ["音質", "録音", "KU100", "マイク", "ノイズ", "音量", "環境音", "SE"],
  immersion: ["定位", "左右", "密着", "距離", "耳元", "バイノーラル", "没入", "近接"],
  pleasure: ["演技", "声優", "CV", "葵", "テンポ", "耳舐め", "キス", "フェラ", "本番", "えっち"],
  satisfaction: ["満足", "余韻", "ループ", "特典", "長尺", "尺", "糖度", "イチャラブ", "コンセプト"],
};

function reviewBody(rv) {
  return `${rv.review_title ?? ""}\n${rv.review_text ?? ""}`.trim();
}

function countThemeHits(text, keywords) {
  const t = String(text ?? "");
  let n = 0;
  for (const k of keywords) {
    if (t.includes(k)) n += 1;
  }
  return n;
}

function countThemes(text) {
  const out = {};
  for (const [name, keywords] of Object.entries(TEXT_THEMES)) {
    const n = countThemeHits(text, keywords);
    if (n > 0) out[name] = n;
  }
  return out;
}

function mergeCounts(target, source) {
  for (const [k, v] of Object.entries(source)) {
    target[k] = (target[k] ?? 0) + v;
  }
}

function topEntries(counts, limit = 8) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function axisHitsFromAll(text) {
  const out = {};
  for (const [axis, hints] of Object.entries(AXIS_HINTS)) {
    out[axis] = countThemeHits(text, hints);
  }
  return out;
}

function suggestReflections(themeCounts) {
  const recommended = [];
  const caution = [];
  const top = topEntries(themeCounts, 6).map((x) => x.label);

  if (top.some((t) => t.includes("イチャラブ") || t.includes("あまあま"))) {
    recommended.push("あまあま・純愛の甘さを長尺で味わいたい層");
  }
  if (top.some((t) => t.includes("小悪魔") || t.includes("からかい"))) {
    recommended.push("からかいから恋人への関係の変化・小悪魔後輩が好きな層");
  }
  if (top.some((t) => t.includes("キス") || t.includes("耳舐"))) {
    recommended.push("キス・耳舐め・密着スキンシップを主役にしたい層");
  }
  if (top.some((t) => t.includes("添い寝") || t.includes("安眠"))) {
    recommended.push("添い寝・安眠寄りの聴き方もしたい層");
  }
  if (top.some((t) => t.includes("お泊まり") || t.includes("連戦"))) {
    recommended.push("恋人成立後の密度・連戦展開を期待する層");
  }

  if (themeCounts["穏やか・オホ声なし"] > 0) {
    caution.push("オホ声・過激喘ぎ一発高揚を主目的にする層");
  }
  if (themeCounts["添い寝・安眠"] > 0) {
    caution.push("最後まで一気通貫で刺激だけ追い続けたい層（寝落ちしやすい）");
  }

  return {
    recommendedForHints: [...new Set(recommended)].slice(0, 5),
    notRecommendedForHints: [...new Set(caution)].slice(0, 4),
  };
}

async function fetchAllReviews(productId) {
  const all = [];
  let page = 1;
  for (;;) {
    const params = new URLSearchParams({
      product_id: productId,
      limit: String(PAGE_LIMIT),
      mix_pickup: "1",
      page: String(page),
      order: "regist_d",
      locale: "ja_JP",
    });
    const res = await axios.get(`${API}?${params}`, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "ja",
        Referer: `https://www.dlsite.com/maniax/work/=/product_id/${productId}.html`,
      },
      timeout: 35000,
    });
    const data = res.data;
    if (!data?.is_success) {
      throw new Error(data?.error_msg || "DLsite review API failed");
    }
    const batch = data.review_list ?? [];
    all.push(...batch);
    if (batch.length < PAGE_LIMIT) break;
    page += 1;
    await new Promise((r) => setTimeout(r, 800));
  }
  return all;
}

function buildTrends(reviews) {
  const themeCounts = {};
  const axisCounts = {};
  const bodies = [];

  for (const rv of reviews) {
    const text = reviewBody(rv);
    if (!text) continue;
    bodies.push(text);
    mergeCounts(themeCounts, countThemes(text));
  }

  for (const text of bodies) {
    mergeCounts(axisCounts, axisHitsFromAll(text));
  }

  const reflections = suggestReflections(themeCounts);

  return {
    fetchedAt: new Date().toISOString(),
    source: "review_text_only",
    total: reviews.length,
    textReviewCount: bodies.length,
    recurringThemes: topEntries(themeCounts),
    axisHints: topEntries(axisCounts).map(({ label, count }) => ({
      axis: label,
      count,
    })),
    ...reflections,
  };
}

function trendsNoteLine(trends) {
  const themes = trends.recurringThemes
    .slice(0, 5)
    .map((x) => `${x.label}(${x.count})`)
    .join("、");
  const rec = trends.recommendedForHints.slice(0, 3).join("／") || "—";
  const avoid = trends.notRecommendedForHints.slice(0, 2).join("／") || "—";
  return (
    `【DLsite購入者レビュー（温度感メモ・内部用）】全${trends.textReviewCount}件。言及テーマ: ${themes || "—"}。` +
    `温度参考: ${rec}。注意参考: ${avoid}。index本文・グラフ・総評・おすすめへ内容反映禁止（§8.4.3）。感想は温度のみ。`
  );
}

function updateAnalysisNotes(slug, noteLine) {
  const fp = path.join(REVIEW_ROOT, slug, "_分析データ.json");
  if (!fs.existsSync(fp)) {
    console.warn(`skip notes: ${fp} not found`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(fp, "utf8"));
  const notes = Array.isArray(data.notes) ? [...data.notes] : [];
  const prefixes = ["【DLsiteユーザーレビュー傾向】", "【DLsite購入者レビュー（文章）】"];
  const filtered = notes.filter(
    (n) => !prefixes.some((p) => String(n).startsWith(p))
  );
  filtered.push(noteLine);
  data.notes = filtered;
  fs.writeFileSync(fp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`updated notes: ${fp}`);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const updateNotes = process.argv.includes("--update-notes");
  const productId = (args[0] ?? "").toUpperCase();
  const slug = args[1];

  if (!/^RJ\d+$/i.test(productId)) {
    console.error(
      "Usage: node scripts/fetch-dlsite-user-reviews.mjs RJ… [slug] [--update-notes]"
    );
    process.exit(1);
  }

  console.log(`fetching DLsite review texts: ${productId}`);
  const reviews = await fetchAllReviews(productId);
  console.log(`fetched ${reviews.length} review(s)`);

  const trends = buildTrends(reviews);
  const noteLine = trendsNoteLine(trends);
  console.log(noteLine);
  if (trends.recommendedForHints.length) {
    console.log("recommended hints:", trends.recommendedForHints.join(" | "));
  }
  if (trends.notRecommendedForHints.length) {
    console.log("caution hints:", trends.notRecommendedForHints.join(" | "));
  }

  if (!slug) return;

  const reviewDir = path.join(REVIEW_ROOT, slug);
  if (!fs.existsSync(reviewDir)) {
    console.error(`review folder not found: ${reviewDir}`);
    process.exit(1);
  }
  const dir = path.join(reviewDir, "analysis");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const slimReviews = reviews.map((rv) => ({
    id: rv.member_review_id,
    title: rv.review_title,
    text: rv.review_text,
  }));

  const rawPath = path.join(dir, "dlsite_reviews.auto.json");
  const trendsPath = path.join(dir, "dlsite_review_trends.auto.json");
  fs.writeFileSync(
    rawPath,
    `${JSON.stringify({ productId, reviews: slimReviews }, null, 2)}\n`,
    "utf8"
  );
  fs.writeFileSync(trendsPath, `${JSON.stringify(trends, null, 2)}\n`, "utf8");
  console.log(`wrote ${rawPath}`);
  console.log(`wrote ${trendsPath}`);

  if (updateNotes) updateAnalysisNotes(slug, noteLine);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
