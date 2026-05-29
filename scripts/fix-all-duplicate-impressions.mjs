import { readFile, writeFile } from "node:fs/promises";

const tsxPath = "src/app/(public)/reviews/[slug]/page.tsx";
let text = await readFile(tsxPath, "utf8");
const slugRe = /"([a-z0-9-]+)": \{/g;
let fixed = 0;
let m;
const parts = [];
let last = 0;

while ((m = slugRe.exec(text))) {
  const slug = m[1];
  let depth = 0;
  let end = m.index;
  for (let i = m.index + slug.length + 3; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  parts.push(text.slice(last, m.index));
  const entry = text.slice(m.index, end);
  const blocks = [...entry.matchAll(/workImpressionParagraphs: \[[\s\S]*?\],/g)];
  if (blocks.length > 1) {
    const lastBlock = blocks[blocks.length - 1][0];
    let clean = entry.replace(/workImpressionParagraphs: \[[\s\S]*?\],/g, "");
    clean = clean.replace(
      /(notRecommendedFor: \[[\s\S]*?\],)/,
      `$1\n      ${lastBlock}`,
    );
    parts.push(clean);
    fixed++;
    console.log(`Fixed ${slug}: removed ${blocks.length - 1} duplicate(s)`);
  } else {
    parts.push(entry);
  }
  last = end;
}
parts.push(text.slice(last));

if (fixed) {
  await writeFile(tsxPath, parts.join(""), "utf8");
  console.log(`Total: ${fixed} slug(s) fixed`);
} else {
  console.log("No duplicates found");
}
