/**
 * 催眠音声記事原紙（B 型ガワ）を生成する。
 * 本文は未記入。完成系は asmr-saimin-aman-toro-lip 準拠（docs/真催眠音声執筆ガイド §1 補 B型）。
 *
 * 使い方:
 *   node scripts/create-hypnosis-review-shell.mjs <slug> --item-name "【ASMR×催○音声】作品名"
 *   npm run review:create-genkami -- <slug> --item-name "…"
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TEMPLATE_DIR = path.join(ROOT, "templates", "催眠音声記事原紙");
const TEMPLATE_PATH = path.join(TEMPLATE_DIR, "index.template.md");
const REVIEWS_DIR = path.join(ROOT, "src", "content", "レビュー");

const SENSITIVITY_LEVELS = [
  { lv: 1, grade: "トランス未経験", desc: "トランス感覚がまだ掴めない" },
  { lv: 2, grade: "初級トランス", desc: "重感・深い脱力まで導入できる" },
  { lv: 3, grade: "中級トランス", desc: "暗示を受け入れられる（絶頂反応は未達）" },
  { lv: 4, grade: "上級トランス", desc: "脳イキは可能（ドライ絶頂は未達）" },
  { lv: 5, grade: "開発済", desc: "脳イキ・ドライを高再現で自律発生できる" },
];

function usage(exitCode = 1) {
  console.error(`催眠音声記事原紙 — B型レビューのガワを生成

使い方:
  node scripts/create-hypnosis-review-shell.mjs <slug> [options]

必須:
  <slug>              英数字・ハイフン（例: asmr-saimin-example）

オプション:
  --item-name <text>  商品名（frontmatter itemName / 作品名見出し）
  --circle <text>     サークル名（既定: （記入））
  --rj <id>           DLsite ID（例: RJ312554）
  --sale-date <iso>   saleDate（YYYY-MM-DD、既定: 2000-01-01）
  --published-at <d>  publishedAt（YYYY-MM-DD、既定: 今日 JST）
  --recommended-lv <n> 推奨感度 1–5（既定: 2）
  --dry-run           ファイルを書かず標準出力
  -h, --help          このヘルプ

生成先:
  src/content/レビュー/<slug>/index.md
  src/content/レビュー/<slug>/_分析データ.json

執筆後: quickGuideBySlug・products.json・review_triangle.png を別途用意。
詳細: templates/催眠音声記事原紙/README.md
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const positional = [];
  const opts = {
    itemName: "",
    circle: "（記入）",
    rj: "",
    saleDate: "2000-01-01",
    publishedAt: "",
    recommendedLv: 2,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") usage(0);
    if (a === "--dry-run") {
      opts.dryRun = true;
      continue;
    }
    if (a === "--item-name") {
      opts.itemName = argv[++i] ?? "";
      continue;
    }
    if (a === "--circle") {
      opts.circle = argv[++i] ?? opts.circle;
      continue;
    }
    if (a === "--rj") {
      opts.rj = (argv[++i] ?? "").trim().toUpperCase();
      continue;
    }
    if (a === "--sale-date") {
      opts.saleDate = argv[++i] ?? opts.saleDate;
      continue;
    }
    if (a === "--published-at") {
      opts.publishedAt = argv[++i] ?? "";
      continue;
    }
    if (a === "--recommended-lv") {
      opts.recommendedLv = Number(argv[++i]);
      continue;
    }
    if (a.startsWith("-")) {
      console.error(`不明なオプション: ${a}`);
      usage();
    }
    positional.push(a);
  }

  const slug = positional[0]?.trim();
  if (!slug) usage();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error(`slug は英小文字・数字・ハイフンのみにしてください: ${slug}`);
    process.exit(1);
  }
  if (!Number.isInteger(opts.recommendedLv) || opts.recommendedLv < 1 || opts.recommendedLv > 5) {
    console.error("--recommended-lv は 1〜5 の整数です");
    process.exit(1);
  }

  return { slug, ...opts };
}

function todayJstYmd() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function dlsiteRjFolder(rj) {
  const m = /^RJ(\d+)$/i.exec(rj.trim());
  if (!m) return "";
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return "";
  const bucket = Math.ceil(n / 1000) * 1000;
  return `RJ${String(bucket).padStart(6, "0")}`;
}

function buildDlsiteUrls(rj) {
  if (!rj) {
    return {
      coverImage: "（RJ 指定後に DLsite 表記に合わせて記入）",
      coverAffiliateHref: "（記入）",
      affiliateHref: "（記入）",
      dlsiteProductId: "（記入）",
    };
  }
  const folder = dlsiteRjFolder(rj);
  const id = rj.toUpperCase();
  return {
    coverImage: `https://img.dlsite.jp/modpub/images2/work/doujin/${folder}/${id}_img_main.jpg`,
    coverAffiliateHref: `https://dlaf.jp/maniax/dlaf/=/t/i/link/work/aid/reviewLab/id/${id}.html`,
    affiliateHref: `https://dlaf.jp/maniax/dlaf/=/t/n/link/work/aid/reviewLab/id/${id}.html`,
    dlsiteProductId: id,
  };
}

function buildSensitivityCardsHtml(pickLv) {
  const lines = [
    '<div class="review-sensitivity-lv-cards" role="list" aria-label="体験感度Lv一覧">',
    "",
  ];

  for (const { lv, grade, desc } of SENSITIVITY_LEVELS) {
    const pick = lv === pickLv;
    const cls = pick ? " review-sensitivity-lv-card--pick" : "";
    const small = pick ? "<small>推奨</small>" : "";
    lines.push(
      `<div class="review-sensitivity-lv-card${cls}" role="listitem">`,
      `<span class="review-sensitivity-lv-card__lv">Lv${lv}${small}</span>`,
      `<div class="review-sensitivity-lv-card__main">`,
      `<span class="review-sensitivity-lv-card__grade">${grade}</span>`,
      `<span class="review-sensitivity-lv-card__desc">${desc}</span>`,
      `</div>`,
      `</div>`,
      "",
    );
  }

  lines.push("</div>");
  return lines.join("\n");
}

function applyTemplate(template, vars) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    const token = `{{${key}}}`;
    out = out.split(token).join(value);
  }
  const leftover = out.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover?.length) {
    console.warn("未置換のプレースホルダ:", [...new Set(leftover)].join(", "));
  }
  return out;
}

function buildAnalysisJson(itemName) {
  return {
    schemaVersion: 1,
    workName: itemName,
    scores: {
      trance: 0,
      pleasure: 0,
      satisfaction: 0,
    },
    orgasmSummary: "絶頂目安（本文総合評価と同期）: ドライシーン（回）・ウェットシーン（回）",
    notes: [
      `${itemName} — 催眠音声記事原紙（未執筆）`,
      "本文初稿は scripts/gemini-hypnosis-review/auto_review.py（Gemini）で生成すること。",
      "グラフ: py -3 scripts/generate_review_triangle.py <slug>",
    ],
  };
}

function main() {
  const { slug, itemName, circle, rj, saleDate, publishedAt, recommendedLv, dryRun } =
    parseArgs(process.argv.slice(2));

  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error(`テンプレートが見つかりません: ${TEMPLATE_PATH}`);
    process.exit(1);
  }

  const resolvedItemName = itemName.trim() || "（商品名を --item-name で指定）";
  const pub = publishedAt.trim() || todayJstYmd();
  const dlsite = buildDlsiteUrls(rj);
  const pick = SENSITIVITY_LEVELS.find((l) => l.lv === recommendedLv) ?? SENSITIVITY_LEVELS[1];

  const vars = {
    SLUG: slug,
    ITEM_NAME: resolvedItemName,
    CIRCLE_NAME: circle,
    SALE_DATE: saleDate,
    PUBLISHED_AT: pub,
    RECOMMENDED_LV: String(recommendedLv),
    RECOMMENDED_LV_GRADE: pick.grade,
    SENSITIVITY_CARDS_HTML: buildSensitivityCardsHtml(recommendedLv),
    COVER_IMAGE: dlsite.coverImage,
    COVER_AFFILIATE_HREF: dlsite.coverAffiliateHref,
    AFFILIATE_HREF: dlsite.affiliateHref,
    DLSITE_PRODUCT_ID: dlsite.dlsiteProductId,
  };

  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const indexMd = applyTemplate(template, vars);
  const analysisJson = JSON.stringify(buildAnalysisJson(resolvedItemName), null, 2) + "\n";

  const outDir = path.join(REVIEWS_DIR, slug);
  const indexPath = path.join(outDir, "index.md");
  const analysisPath = path.join(outDir, "_分析データ.json");

  if (dryRun) {
    console.log(`# dry-run: ${indexPath}\n`);
    console.log(indexMd);
    console.log(`\n# dry-run: ${analysisPath}\n`);
    console.log(analysisJson);
    return;
  }

  if (fs.existsSync(indexPath)) {
    console.error(`既に存在します: ${indexPath}\n削除または別 slug を指定してください。`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(indexPath, indexMd, "utf8");
  fs.writeFileSync(analysisPath, analysisJson, "utf8");

  console.log(`生成しました:
  ${indexPath}
  ${analysisPath}

次の作業:
  1. scripts/gemini-hypnosis-review/auto_review.py で本文初稿（必須・真執筆ガイド）
  2. review_triangle.png を配置（generate_review_triangle.py）
  3. quickGuideBySlug（page.tsx）・data/products.json
  4. npm run review:audit-kansei -- ${slug}
`);
}

main();
