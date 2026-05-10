import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  // ESM-only（"type":"module"）の依存を Webpack がそのまま解釈すると、開発時に
  // 「Cannot read properties of undefined (reading 'call')」が出ることがあるため明示。
  transpilePackages: ["github-slugger"],
  // true: reviews/foo/index.html になり、拡張子なしURLが LiteSpeed/Apache と相性よい
  trailingSlash: true,
  // 上位ディレクトリに別の package-lock があるとルート推定がずれることがあるため明示
  outputFileTracingRoot: path.join(__dirname),
  // 静的ホスティングでは Image Optimization API が使えないため必須（next/image 利用時）
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
