/**
 * ESM 実装は `update-prices.mjs`。このファイルは CommonJS 環境からも呼べるラッパーです。
 */
const { spawnSync } = require("child_process");
const path = require("path");

const mjsPath = path.join(__dirname, "update-prices.mjs");
const forwarded = process.argv.slice(2);
const r = spawnSync(process.execPath, [mjsPath, ...forwarded], {
  stdio: "inherit",
});
process.exit(r.status === 0 ? 0 : r.status ?? 1);
