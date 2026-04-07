/**
 * `src/content/レビュー`・`src/content/記事` 内の各フォルダに、index.md と一緒に置いた
 * 画像など（.md 以外）を `public/content/レビュー`・`public/content/記事` にミラーする。
 * 静的サイトでは public 配下だけが URL で配信されるため、ビルド・開発起動前に実行する。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const contentRoot = path.join(root, "src", "content");
const publicContent = path.join(root, "public", "content");
const ROOTS = ["レビュー", "記事"];

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyNonMdAssets(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;

  function walk(currentRel) {
    const absDir = path.join(srcDir, currentRel);
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const ent of entries) {
      const rel = path.join(currentRel, ent.name);
      const abs = path.join(srcDir, rel);
      if (ent.isDirectory()) {
        walk(rel);
        continue;
      }
      if (ent.name.toLowerCase().endsWith(".md")) continue;
      if (ent.name.startsWith("_")) continue;
      const dest = path.join(destDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(abs, dest);
    }
  }

  walk("");
}

for (const r of ROOTS) {
  const pub = path.join(publicContent, r);
  rmrf(pub);
  copyNonMdAssets(path.join(contentRoot, r), pub);
}

/**
 * 一覧・詳細のサムネ用: 記事フォルダ内の画像を ASCII の公開 URL に複製する。
 * 第3要素は優先するファイル名（例: 日本語名の JPG）。無ければ cover.jpg 等を順に探す。
 */
const LEGACY_ARTICLE_COVERS = [
  ["hypnosis-mechanism-01", "hypnosis-what-is", "催眠音声とは.jpg"],
  ["nou-iki-toha", path.join("reviews", "nou-iki-toha", "cover"), "脳イキとは.jpg"],
  [
    "dry-orgasm-what-is",
    path.join("reviews", "dry-orgasm-what-is", "cover"),
    "ドライオーガズムとは.jpg",
  ],
];
const COVER_BASENAMES = [
  "cover.jpg",
  "cover.jpeg",
  "cover.png",
  "cover.webp",
  "cover.svg",
];

function copyLegacyArticleCovers() {
  const articleRoot = path.join(contentRoot, "記事");
  for (const entry of LEGACY_ARTICLE_COVERS) {
    const [folder, destBase, preferredName] = entry;
    const dir = path.join(articleRoot, folder);
    let srcPath = null;
    if (preferredName) {
      const pref = path.join(dir, preferredName);
      if (fs.existsSync(pref) && fs.statSync(pref).isFile()) srcPath = pref;
    }
    if (!srcPath) {
      for (const name of COVER_BASENAMES) {
        const p = path.join(dir, name);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          srcPath = p;
          break;
        }
      }
    }
    if (!srcPath) continue;
    const ext = path.extname(srcPath);
    const dest = path.join(publicContent, destBase + ext);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(srcPath, dest);
  }
}

copyLegacyArticleCovers();

console.log(
  "sync-content-assets: mirrored non-.md files from src/content/{レビュー,記事} → public/content/"
);
