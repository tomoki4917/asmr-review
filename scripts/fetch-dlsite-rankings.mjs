/**
 * DLsite ランキング API から順位表を取得し data/dlsite-rankings.json を更新する。
 * トップのブログパーツ（site: home）と同軸。ブラウザからは CORS のため直接取得不可。
 *
 * 実行: npm run update-dlsite-rankings
 *       npm run update-dlsite-rankings:if-stale  （古ければ更新・失敗しても exit 0）
 *
 * フラグ:
 *   --if-stale     fetched_at が新しいうちはスキップ（既定しきい値 24h）
 *   --allow-fail   取得失敗時も exit 0（古い JSON のまま続行。dev 起動用）
 *
 * 環境変数:
 *   DLSITE_RANKING_SITE=home|maniax（既定 home）
 *   DLSITE_RANKING_MAX_AGE_HOURS … --if-stale のしきい値（既定 24）
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

const argv = new Set(process.argv.slice(2));
const ifStale = argv.has("--if-stale");
const allowFail = argv.has("--allow-fail");

const site = (process.env.DLSITE_RANKING_SITE || "home").trim();
if (site !== "home" && site !== "maniax") {
  console.error("DLSITE_RANKING_SITE は home または maniax にしてください");
  process.exit(1);
}

const maxAgeHours = (() => {
  const raw = process.env.DLSITE_RANKING_MAX_AGE_HOURS;
  if (raw == null || String(raw).trim() === "") return 24;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 24;
})();

function fail(message, code = 1) {
  console.error(message);
  process.exit(allowFail ? 0 : code);
}

/**
 * @returns {boolean} true = まだ新しいのでスキップしてよい
 */
function isFreshEnough() {
  if (!fs.existsSync(OUT)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(OUT, "utf8"));
    const fetchedAt = raw && typeof raw.fetched_at === "string" ? raw.fetched_at : null;
    if (!fetchedAt) return false;
    const ageMs = Date.now() - Date.parse(fetchedAt);
    if (!Number.isFinite(ageMs) || ageMs < 0) return false;
    const maxMs = maxAgeHours * 60 * 60 * 1000;
    if (ageMs < maxMs) {
      const ageH = (ageMs / 3600000).toFixed(1);
      console.log(
        `skip: data/dlsite-rankings.json は ${ageH}h 前（しきい値 ${maxAgeHours}h）`
      );
      return true;
    }
  } catch {
    return false;
  }
  return false;
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
  if (ifStale && isFreshEnough()) return;

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
      fail(`  ${period}: 失敗 (${msg}) — 既存 JSON を維持`);
      return;
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

main().catch((e) => {
  fail(e && e.message ? e.message : String(e));
});
