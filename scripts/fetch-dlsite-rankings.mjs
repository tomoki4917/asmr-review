/**
 * DLsite ランキング API から順位表を取得し data/dlsite-rankings.json を更新する。
 * トップのブログパーツ（site: home）と同軸。ブラウザからは CORS のため直接取得不可。
 *
 * 実行: npm run update-dlsite-rankings
 * 環境変数 DLSITE_RANKING_SITE=home|maniax（既定 home）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "dlsite-rankings.json");

const PERIODS = ["day", "week", "month", "year", "total"];
const DELAY_MS = 2500;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

const site = (process.env.DLSITE_RANKING_SITE || "home").trim();
if (site !== "home" && site !== "maniax") {
  console.error("DLSITE_RANKING_SITE は home または maniax にしてください");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeProductId(raw) {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!/^RJ\d+$/i.test(s)) return null;
  return s.replace(/^rj/i, "RJ");
}

/**
 * @param {unknown} data
 * @returns {{ rank: number, product_id: string }[]}
 */
function parseRankingRows(data) {
  if (!Array.isArray(data)) return [];
  const out = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const id = normalizeProductId(
      row && typeof row === "object" ? row.product_id : null
    );
    if (!id) continue;
    out.push({ rank: i + 1, product_id: id });
  }
  return out;
}

async function fetchPeriod(period) {
  const url = `https://www.dlsite.com/${site}/api/=/ranking.json`;
  const res = await axios.get(url, {
    params: { period },
    timeout: 45000,
    headers: {
      "User-Agent": UA,
      Accept: "application/json,text/plain,*/*",
      "Accept-Language": "ja,en;q=0.9",
      Referer: "https://www.dlsite.com/",
    },
    validateStatus: (s) => s >= 200 && s < 400,
  });
  const entries = parseRankingRows(res.data);
  console.log(`  ${period}: ${entries.length} 件`);
  return entries;
}

async function main() {
  console.log(`DLsite ランキング取得 (site=${site})`);
  /** @type {Record<string, { entries: { rank: number, product_id: string }[] }>} */
  const periods = {};

  for (let i = 0; i < PERIODS.length; i++) {
    const period = PERIODS[i];
    if (i > 0) await sleep(DELAY_MS);
    try {
      periods[period] = { entries: await fetchPeriod(period) };
    } catch (e) {
      const msg = e.response?.status
        ? `HTTP ${e.response.status}`
        : e.message || String(e);
      console.error(`  ${period}: 失敗 (${msg})`);
      process.exit(1);
    }
  }

  const payload = {
    site,
    fetched_at: new Date().toISOString(),
    periods,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`wrote ${OUT}`);
}

main();
