import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const targets = ["data", path.join("src", "content")];
const jsonFiles = [];
const conflictMarkerPattern = /^(<<<<<<<|=======|>>>>>>>)/m;
const errors = [];

async function collectJsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectJsonFiles(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      jsonFiles.push(fullPath);
    }
  }
}

for (const relativeTarget of targets) {
  const absoluteTarget = path.join(repoRoot, relativeTarget);
  await collectJsonFiles(absoluteTarget);
}

for (const filePath of jsonFiles) {
  const content = await readFile(filePath, "utf8");
  const relativePath = path.relative(repoRoot, filePath);

  if (conflictMarkerPattern.test(content)) {
    errors.push(
      `[merge-marker] ${relativePath} contains unresolved conflict markers`
    );
    continue;
  }

  try {
    JSON.parse(content);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    errors.push(`[invalid-json] ${relativePath}: ${reason}`);
  }
}

if (errors.length > 0) {
  console.error("Content data validation failed:");
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log(
  `Content data validation passed (${jsonFiles.length} JSON files checked).`
);
