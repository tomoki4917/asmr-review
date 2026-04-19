/**
 * ESM 実装は `update-prices.mjs`。このファイルは CommonJS 環境からも呼べるラッパーです。
 */
const { spawnSync } = require("child_process");
const path = require("path");

const r = spawnSync(
  process.execPath,
  [path.join(__dirname, "update-prices.mjs")],
  { stdio: "inherit" }
);
process.exit(r.status === 0 ? 0 : r.status ?? 1);
