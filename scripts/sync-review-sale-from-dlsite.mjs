/**
 * 各レビュー index.md に、DLsite HTML の contents.detail[0].regist_date に基づく
 * saleDate（YYYY-MM-DD）と `### 基本情報` の `- **販売日：**` 行を付与／更新する。
 *
 * 使い方: node scripts/sync-review-sale-from-dlsite.mjs
 * 連続取得間は 3〜7 秒のランダム待機（負荷平準化）。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const REVIEW_DIR = path.join(ROOT, "src", "content", "レビュー");
const PRODUCTS = path.join(ROOT, "data", "products.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelayMs() {
  return 3000 + Math.floor(Math.random() * 4001);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** regist YYYY/M/D → YYYY-MM-DD */
function registToYmd(regist) {
  if (regist == null) return "";
  const s = String(regist).trim();
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return "";
  return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
}

function ymdToJa(ymd) {
  const p = ymd.split("-");
  if (p.length !== 3) return ymd;
  const y = Number(p[0]);
  const mo = Number(p[1]);
  const d = Number(p[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return ymd;
  return `${y}年${mo}月${d}日`;
}

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

function splitFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const sep = "\n---\n";
  if (text.slice(end, end + sep.length) !== sep) return null;
  return {
    fm: text.slice(4, end),
    body: text.slice(end + sep.length),
    sep,
  };
}

function yamlGet(fm, key) {
  const re = new RegExp(`^${key}:\\s*(?:"([^"]*)"|([^\\n#]+))\\s*$`, "m");
  const m = fm.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim().replace(/^["']|["']$/g, "");
}

function upsertSaleDateFm(fm, ymd) {
  if (/^saleDate:\s/m.test(fm)) {
    return fm.replace(/^saleDate:\s*.+$/m, `saleDate: "${ymd}"`);
  }
  const block =
    `# 作品の販売開始日（販売ページの販売日／DLsite regist_date に準拠）\nsaleDate: "${ymd}"\n`;
  if (/^authorName:\s/m.test(fm)) {
    return fm.replace(/^(authorName:\s[^\n]+\n)/m, `$1\n${block}`);
  }
  return `${fm.trimEnd()}\n\n${block}`;
}

function upsertBodySaleLine(body, jaDate) {
  const line = `- **販売日：** ${jaDate}（販売ページ表記）`;
  if (/^- \*\*販売日：\*\*/m.test(body)) {
    return body.replace(/^- \*\*販売日：\*\*\s*.+$/m, line);
  }
  const re = /^(- \*\*サークル：\*\*[^\n]*\n)/m;
  if (re.test(body)) {
    return body.replace(re, `$1${line}\n`);
  }
  const re2 = /(### 基本情報\n\n)/;
  if (re2.test(body)) {
    return body.replace(re2, `$1${line}\n\n`);
  }
  return body;
}

const products = JSON.parse(fs.readFileSync(PRODUCTS, "utf8"));
const byId = new Map(products.map((r) => [String(r.id).toUpperCase(), r]));

const dirs = fs
  .readdirSync(REVIEW_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name)
  .sort();

const log = [];

for (const slug of dirs) {
  const fp = path.join(REVIEW_DIR, slug, "index.md");
  if (!fs.existsSync(fp)) continue;
  const raw = fs.readFileSync(fp, "utf8");
  const parts = splitFrontmatter(raw);
  if (!parts) continue;
  const { fm, body, sep } = parts;
  const contentKind = yamlGet(fm, "contentKind") || "review";
  const dlsite = yamlGet(fm, "dlsiteProductId").toUpperCase();
  if (contentKind === "article" || !dlsite) continue;

  const row = byId.get(dlsite);
  const url =
    row?.url?.trim() ||
    `https://www.dlsite.com/maniax/work/=/product_id/${dlsite}.html`;

  let ymd = "";
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
      validateStatus: (s) => s >= 200 && s < 400,
    });
    const html = String(res.data);
    const detail = parseContentsDetail(html);
    ymd = registToYmd(detail?.regist_date ?? detail?.release_date);
  } catch (e) {
    log.push({ slug, error: e.message || String(e) });
    await sleep(randomDelayMs());
    continue;
  }

  if (!ymd) {
    log.push({ slug, error: "regist_date 未取得" });
    await sleep(randomDelayMs());
    continue;
  }

  const ja = ymdToJa(ymd);
  const newFm = upsertSaleDateFm(fm, ymd);
  const newBody = upsertBodySaleLine(body, ja);
  const out = `---\n${newFm}${sep}${newBody}`;

  if (out !== raw) {
    fs.writeFileSync(fp, out, "utf8");
    log.push({ slug, updated: true, saleDate: ymd });
  } else {
    log.push({ slug, updated: false, saleDate: ymd });
  }

  await sleep(randomDelayMs());
}

const report = path.join(ROOT, "scripts", "sync-sale-date-log.json");
fs.writeFileSync(report, `${JSON.stringify(log, null, 2)}\n`, "utf8");
console.log(`Done. Log: ${report}`);
