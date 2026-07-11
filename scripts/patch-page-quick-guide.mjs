import fs from "node:fs";

const pagePath = "src/app/(public)/reviews/[slug]/page.tsx";
const lines = fs.readFileSync(pagePath, "utf8").split(/\r?\n/);

const startIdx = lines.findIndex((l) => l.includes("const quickGuideBySlug:"));
const specIdx = lines.findIndex(
  (l, i) => i > startIdx && l.trim().startsWith("const quickGuideSpec")
);
if (startIdx < 0 || specIdx < 0) throw new Error("block not found");

const importLine = 'import { quickGuideBySlug } from "@/lib/quick-guide-by-slug";';
const hasImport = lines.some((l) => l.includes('from "@/lib/quick-guide-by-slug"'));
if (!hasImport) {
  const importInsert = lines.findIndex((l) => l.startsWith("import "));
  let lastImport = importInsert;
  for (let i = importInsert; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImport = i;
    else if (lines[i].trim() === "" && i > importInsert) break;
  }
  lines.splice(lastImport + 1, 0, importLine);
  const newStart = lines.findIndex((l) => l.includes("const quickGuideBySlug:"));
  const newSpec = lines.findIndex(
    (l, i) => i > newStart && l.trim().startsWith("const quickGuideSpec")
  );
  lines.splice(newStart, newSpec - newStart);
} else {
  lines.splice(startIdx, specIdx - startIdx);
}

fs.writeFileSync(pagePath, lines.join("\n"), "utf8");
console.log("page.tsx updated");
