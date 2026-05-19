/**
 * レビューの dlsiteProductId と data/products.json の価格取得状態を検証する。
 * プレースホルダー（current_price: 0 かつ fetched_at 空）は「無料」と誤表示されるためビルド前に失敗させる。
 *
 * Usage: node scripts/validate-dlsite-prices.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const REVIEW_DIR = path.join(ROOT, "src", "content", "レビュー");
const PRODUCTS = path.join(ROOT, "data", "products.json");

function splitFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { fm: "" };
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return { fm: "" };
  return { fm: text.slice(4, end) };
}

function yamlGet(fm, key) {
  const re = new RegExp(`^${key}:\\s*(?:"([^"]*)"|([^\\n#]+))\\s*$`, "m");
  const m = fm.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim().replace(/^["']|["']$/g, "");
}

function isPriceFetched(row) {
  const raw = String(row?.fetched_at ?? "").trim();
  if (!raw) return false;
  return !Number.isNaN(Date.parse(raw));
}

const products = JSON.parse(fs.readFileSync(PRODUCTS, "utf8"));
const byId = new Map(products.map((r) => [String(r.id).toUpperCase(), r]));

const errors = [];

const dirs = fs
  .readdirSync(REVIEW_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);

for (const slug of dirs.sort()) {
  const fp = path.join(REVIEW_DIR, slug, "index.md");
  if (!fs.existsSync(fp)) continue;
  const { fm } = splitFrontmatter(fs.readFileSync(fp, "utf8"));
  const contentKind = yamlGet(fm, "contentKind") || "review";
  if (contentKind === "article") continue;

  const id = yamlGet(fm, "dlsiteProductId").toUpperCase();
  if (!id) continue;

  const row = byId.get(id);
  if (!row) {
    errors.push(
      `[missing-products-row] ${slug}: dlsiteProductId ${id} が data/products.json にありません`
    );
    continue;
  }

  if (!isPriceFetched(row)) {
    errors.push(
      `[price-not-fetched] ${slug}: ${id} の fetched_at が空です。npm run update-price:one ${id} を実行してください（手動で current_price: 0 だけ置かない）`
    );
  }
}

if (errors.length > 0) {
  console.error("DLsite price validation failed:");
  for (const e of errors) {
    console.error(`- ${e}`);
  }
  process.exit(1);
}

console.log(
  `DLsite price validation passed (${dirs.length} review folders scanned).`
);
