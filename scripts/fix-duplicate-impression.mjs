import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/fix-duplicate-impression.mjs <slug>");
  process.exit(1);
}

const tsxPath = path.join("src/app/(public)/reviews/[slug]/page.tsx");
let text = await readFile(tsxPath, "utf8");
const key = `"${slug}"`;
const start = text.indexOf(`${key}: {`);
if (start < 0) process.exit("slug not found");

let depth = 0;
let end = start;
for (let i = text.indexOf("{", start); i < text.length; i++) {
  if (text[i] === "{") depth++;
  else if (text[i] === "}") {
    depth--;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}

const block = text.slice(start, end);
const re = /workImpressionParagraphs: \[[\s\S]*?\],/g;
const matches = [...block.matchAll(re)];
if (matches.length <= 1) {
  console.log(`OK: ${matches.length} block(s)`);
  process.exit(0);
}

const last = matches[matches.length - 1][0];
let clean = block.replace(re, "");
clean = clean.replace(
  /(notRecommendedFor: \[[\s\S]*?\],)/,
  `$1\n      ${last}`,
);
text = text.slice(0, start) + clean + text.slice(end);
await writeFile(tsxPath, text, "utf8");
console.log(`Fixed ${slug}: removed ${matches.length - 1} duplicate(s)`);
