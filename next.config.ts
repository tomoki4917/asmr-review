import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  // 上位ディレクトリに別の package-lock があるとルート推定がずれることがあるため明示
  outputFileTracingRoot: path.join(__dirname),
  // 静的ホスティングでは Image Optimization API が使えないため必須（next/image 利用時）
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
