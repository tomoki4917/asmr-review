import { readFileSync, writeFileSync } from "node:fs";

const targetPath = process.argv[2];
const sourcePath =
  process.argv[3] ?? "src/content/レビュー/brain-washer/index.md";
if (!targetPath) {
  throw new Error(
    "usage: node _insert-cards.mjs <target-index.md> [source-index.md]"
  );
}

const marker = "</div>\n\n**おすすめしたい方**";
const cardsStart = '<div class="review-sensitivity-lv-cards"';
const src = readFileSync(sourcePath, "utf8");
const cards = src.slice(
  src.indexOf(cardsStart),
  src.indexOf(marker, src.indexOf(cardsStart))
);
let t = readFileSync(targetPath, "utf8");
if (t.includes("PLACEHOLDER_CARDS")) {
  t = t.replace("PLACEHOLDER_CARDS", cards.trim());
} else {
  const s = t.indexOf(cardsStart);
  const e = t.indexOf(marker, s);
  t = t.slice(0, s) + cards + t.slice(e);
}
writeFileSync(targetPath, t);
console.log("ok");
