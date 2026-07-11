import type { MetadataRoute } from "next";
import { canonicalSiteUrl } from "@/lib/og-metadata";

/** `output: "export"` ではビルド時に robots.txt を書き出す */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const base = canonicalSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dev/", "/admin/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
