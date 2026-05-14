/**
 * レビュー index.md を DLsite 作品ページと products.json と突き合わせる。
 * 使い方: node scripts/audit-reviews-dlsite.mjs
 *
 * 出力: `scripts/audit-result.json`（UTF-8）
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const REVIEW_DIR = path.join(ROOT, "src", "content", "レビュー");
const PRODUCTS = path.join(ROOT, "data", "products.json");
const OUT_JSON = path.join(ROOT, "scripts", "audit-result.json");

const UA =
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

/** DLsite <title> の `[…]` からサークル名を抽出（`[. [Dot-Space]]` のような二重閉じ括弧は内側を採用） */
function parseMakerFromTitle(html) {
  const m = String(html).match(/<title>([^<]+)<\/title>/i);
  if (!m?.[1]) return "";
  const t = m[1].trim();
  const pipe = (t.split(/\s*\|\s*DLsite/i)[0] ?? "").trim();
  const doubleClose = pipe.match(/\s\[([^\[\]]+)\]\s*\]\s*$/);
  if (doubleClose?.[1]) return doubleClose[1].trim();
  const all = [...pipe.matchAll(/\[([^\]]+)\]/g)];
  return all.length ? (all[all.length - 1][1] ?? "").trim() : "";
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** regist YYYY/M/D → sale YYYY-MM-DD（JST 暦日） */
function registToSaleYmd(regist) {
  if (regist == null) return "";
  const s = String(regist).trim();
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return "";
  return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
}

function releaseIsoToSaleYmd(iso) {
  if (!iso || typeof iso !== "string") return "";
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const da = parts.find((p) => p.type === "day")?.value;
  if (!y || !mo || !da) return "";
  return `${y}-${mo}-${da}`;
}

function normalizeCircle(s) {
  return String(s ?? "")
    .replace(/\s*（.*?）\s*$/u, "")
    .replace(/\u3000/g, " ")
    .trim();
}

function splitFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { fm: "", body: text };
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return { fm: "", body: text };
  return { fm: text.slice(4, end), body: text.slice(end + 5) };
}

function yamlGet(fm, key) {
  const re = new RegExp(`^${key}:\\s*(?:"([^"]*)"|([^\\n#]+))\\s*$`, "m");
  const m = fm.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim().replace(/^["']|["']$/g, "");
}

function extractBodyCircle(body) {
  const m = body.match(/^- \*\*サークル：\*\*\s*(.+)$/m);
  return m?.[1] ? normalizeCircle(m[1]) : "";
}

function extractBodySaleLine(body) {
  const m = body.match(/^- \*\*販売日：\*\*\s*(.+)$/m);
  return m?.[1] ? m[1].trim() : "";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelayMs() {
  return 3000 + Math.floor(Math.random() * 4001);
}

const products = JSON.parse(fs.readFileSync(PRODUCTS, "utf8"));
const byId = new Map(
  products.map((r) => [String(r.id).toUpperCase(), r])
);

const dirs = fs
  .readdirSync(REVIEW_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);

const rows = [];

for (const slug of dirs.sort()) {
  const fp = path.join(REVIEW_DIR, slug, "index.md");
  if (!fs.existsSync(fp)) continue;
  const raw = fs.readFileSync(fp, "utf8");
  const { fm, body } = splitFrontmatter(raw);
  const dlsite = yamlGet(fm, "dlsiteProductId").toUpperCase();
  const contentKind = yamlGet(fm, "contentKind") || "review";
  if (contentKind === "article" || !dlsite) continue;

  const circleFm = normalizeCircle(yamlGet(fm, "circleName"));
  const circleBody = extractBodyCircle(body);
  const effectiveCircle = circleFm || circleBody;

  const saleDate = yamlGet(fm, "saleDate");
  const bodySale = extractBodySaleLine(body);

  const prod = byId.get(dlsite);
  const expectedFromProducts = prod?.release_date_iso
    ? releaseIsoToSaleYmd(prod.release_date_iso)
    : "";

  const url =
    prod?.url?.trim() ||
    `https://www.dlsite.com/maniax/work/=/product_id/${dlsite}.html`;

  let dlsiteMaker = "";
  let dlsiteRegistYmd = "";
  let fetchError = "";

  try {
    const res = await axios.get(url, {
      timeout: 35000,
      headers: {
        "User-Agent": UA,
        "Accept-Language": "ja,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: "https://www.dlsite.com/",
      },
      validateStatus: (s) => s >= 200 && s < 500,
    });
    if (res.status >= 400) {
      fetchError = `HTTP ${res.status}`;
    } else {
      const html = String(res.data);
      dlsiteMaker = parseMakerFromTitle(html);
      const detail = parseContentsDetail(html);
      dlsiteRegistYmd = registToSaleYmd(detail?.regist_date ?? detail?.release_date);
    }
  } catch (e) {
    fetchError = e.message || String(e);
  }

  const circleMismatch =
    dlsiteMaker &&
    effectiveCircle &&
    normalizeCircle(dlsiteMaker) !== normalizeCircle(effectiveCircle);

  const circleMissingEffective = !effectiveCircle;

  const expectedSale = dlsiteRegistYmd || expectedFromProducts;
  const saleMissing = !saleDate;
  const saleMismatch =
    saleDate && expectedSale && saleDate !== expectedSale;

  const bodySaleMissing = !bodySale;

  rows.push({
    slug,
    dlsiteProductId: dlsite,
    productsJsonRow: Boolean(prod),
    dlsite_fetch_error: fetchError || undefined,
    circle_dlsite_title: dlsiteMaker || undefined,
    circle_frontmatter: circleFm || undefined,
    circle_body_line: circleBody || undefined,
    circle_effective: effectiveCircle || undefined,
    circle_mismatch: circleMismatch || undefined,
    circle_missing_effective: circleMissingEffective || undefined,
    saleDate_yaml: saleDate || undefined,
    saleDate_dlsite_regist_ymd: dlsiteRegistYmd || undefined,
    saleDate_products_jst_ymd: expectedFromProducts || undefined,
    sale_expected_ymd: expectedSale || undefined,
    sale_missing_yaml: saleMissing || undefined,
    sale_mismatch: saleMismatch || undefined,
    body_sale_line_missing: bodySaleMissing || undefined,
  });

  await sleep(randomDelayMs());
}

const problems = rows.filter(
  (r) =>
    r.circle_mismatch ||
    r.circle_missing_effective ||
    r.sale_missing_yaml ||
    r.sale_mismatch ||
    r.body_sale_line_missing ||
    !r.productsJsonRow ||
    r.dlsite_fetch_error
);

const payload = { total: rows.length, problems: problems.length, rows, problems };
fs.writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${OUT_JSON} (problems: ${problems.length}/${rows.length})`);
