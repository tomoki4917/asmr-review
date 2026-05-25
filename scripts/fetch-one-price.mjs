/**
 * 単一 RJ の価格だけ products.json を更新（全件 update-prices の短縮用）。
 * 使い方: node scripts/fetch-one-price.mjs RJ01129635
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data", "products.json");

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

function parseContentsDetail(html) {
  const m = html.match(/var contents = (\{[\s\S]*?\});/);
  if (!m) return null;
  try {
    const contents = JSON.parse(m[1]);
    const detail = contents?.detail?.[0];
    return detail && typeof detail === "object" ? detail : null;
  } catch {
    return null;
  }
}

function parseGa4($) {
  const el = $("[class*='ga4_event_item']").first();
  const price = parseInt(el.attr("data-price") ?? "", 10);
  const official = parseInt(el.attr("data-official_price") ?? "", 10);
  return {
    price: Number.isFinite(price) ? price : null,
    official_price: Number.isFinite(official) ? official : null,
  };
}

function extractSchemaPriceValidUntilRaw(html) {
  const m =
    html.match(/itemprop=["']priceValidUntil["'][^>]*\bcontent=["']([^"']+)["']/i) ||
    html.match(/\bcontent=["']([^"']+)["'][^>]*\bitemprop=["']priceValidUntil["']/i);
  return m ? m[1].trim() : "";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function registDateToReleaseIso(regist) {
  if (regist == null) return "";
  const s = String(regist).trim();
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return "";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return "";
  const iso = `${y}-${pad2(mo)}-${pad2(d)}T00:00:00+09:00`;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toISOString();
}

const idArg = (process.argv[2] ?? "").trim().toUpperCase();
if (!/^RJ\d+$/i.test(idArg)) {
  console.error("使い方: node scripts/fetch-one-price.mjs RJ01129635");
  process.exit(1);
}

const list = JSON.parse(fs.readFileSync(OUT, "utf8"));
const idx = list.findIndex((r) => String(r.id).toUpperCase() === idArg);
if (idx < 0) {
  console.error(`products.json に ${idArg} がありません`);
  process.exit(1);
}

const row = list[idx];
const url = String(row.url ?? "").trim();
if (!url) {
  console.error("url なし");
  process.exit(1);
}

const res = await axios.get(url, {
  timeout: 30000,
  headers: {
    "User-Agent": CHROME_USER_AGENT,
    "Accept-Language": "ja,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    Referer: "https://www.dlsite.com/",
  },
  validateStatus: (s) => s >= 200 && s < 400,
});

const html = typeof res.data === "string" ? res.data : String(res.data);
const $ = cheerio.load(html);
const ga4 = parseGa4($);
const detail = parseContentsDetail(html);

let current = ga4.price;
let original = ga4.official_price;
if (!(Number.isFinite(current) && current >= 0) && detail) {
  const p = parseInt(String(detail.price ?? ""), 10);
  if (Number.isFinite(p) && p >= 0) current = p;
}
if (!(Number.isFinite(original) && original >= 0) && detail) {
  const o = parseInt(String(detail.official_price ?? ""), 10);
  if (Number.isFinite(o) && o >= 0) original = o;
}
if (!(Number.isFinite(current) && current >= 0)) {
  console.error("価格を HTML から取得できませんでした");
  process.exit(1);
}
if (!(Number.isFinite(original) && original >= 0)) original = current;

if (original < current) original = current;
const on_sale = original > current && current > 0;
const discount_rate =
  on_sale && original > 0
    ? Math.min(100, Math.max(0, Math.round((1 - current / original) * 100)))
    : 0;
const sale_end_iso = extractSchemaPriceValidUntilRaw(html);
const fetched_at = new Date().toISOString();
const release_date_iso =
  registDateToReleaseIso(detail?.regist_date ?? detail?.release_date) ||
  (typeof row.release_date_iso === "string" ? row.release_date_iso.trim() : "") ||
  "";

list[idx] = {
  ...row,
  id: idArg,
  url,
  current_price: current,
  original_price: original,
  discount_rate,
  on_sale,
  sale_limit: row.sale_limit ?? "",
  sale_end_iso,
  release_date_iso,
  fetched_at,
};

fs.writeFileSync(OUT, `${JSON.stringify(list, null, 2)}\n`, "utf8");
console.log("更新:", list[idx]);
