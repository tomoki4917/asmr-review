import fs from "node:fs";

const pagePath = "src/app/(public)/reviews/[slug]/page.tsx";
const outPath = "src/lib/quick-guide-by-slug.ts";
const text = fs.readFileSync(pagePath, "utf8");
const lines = text.split(/\r?\n/);

const startIdx = lines.findIndex((l) => l.includes("const quickGuideBySlug:"));
const specIdx = lines.findIndex(
  (l, i) => i > startIdx && l.trim().startsWith("const quickGuideSpec")
);
if (startIdx < 0 || specIdx < 0) {
  throw new Error("quickGuideBySlug block not found");
}

const objectLines = lines.slice(startIdx, specIdx);
const eqIdx = objectLines.findIndex((l) => l.includes("= {"));
if (eqIdx < 0) throw new Error("object start not found");
const dataLines = objectLines.slice(eqIdx).join("\n");

const header = `export type QuickGuideSpec = {
  scoreLabel: string;
  oneLine: string;
  inductionType: string;
  voiceActor: string;
  majorFetish: string;
  kinkType: string;
  recommendedLevel?: string;
  recording: string;
  recommendedFor: string[];
  notRecommendedFor: string[];
  workImpressionParagraphs?: string[];
};

export const quickGuideBySlug: Record<string, QuickGuideSpec> ${dataLines}
`;

fs.writeFileSync(outPath, header, "utf8");
console.log(`Wrote ${outPath} (${header.length} chars)`);
