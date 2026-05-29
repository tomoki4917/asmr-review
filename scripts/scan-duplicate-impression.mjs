import { readFile } from "node:fs/promises";

const text = await readFile("src/app/(public)/reviews/[slug]/page.tsx", "utf8");
const slugRe = /"([a-z0-9-]+)": \{/g;
const dupes = [];
let m;
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
  const entry = text.slice(m.index, end);
  const count = (entry.match(/workImpressionParagraphs:/g) || []).length;
  if (count > 1) dupes.push({ slug, count });
}
if (!dupes.length) {
  console.log("No duplicate workImpressionParagraphs found.");
} else {
  for (const d of dupes) console.log(`${d.slug}: ${d.count} blocks`);
  process.exit(1);
}
