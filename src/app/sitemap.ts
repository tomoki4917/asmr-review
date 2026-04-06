import type { MetadataRoute } from "next";
import { getAllReviews } from "@/lib/reviews";

/** `output: "export"` ではビルド時に sitemap を書き出す必要がある */
export const dynamic = "force-static";

const BASE_URL = "https://asmr-reviewrabo.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const reviews = getAllReviews();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/contact/`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy/`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/disclaimer/`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const reviewEntries: MetadataRoute.Sitemap = reviews.map((r) => ({
    url: `${BASE_URL}/reviews/${r.slug}/`,
    lastModified: new Date(r.publishedAt),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticEntries, ...reviewEntries];
}
