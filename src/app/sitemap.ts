import type { MetadataRoute } from "next";
import { articlePublishedTimeIso } from "@/lib/format-published-at";
import { canonicalSiteUrl } from "@/lib/og-metadata";
import { getAllReviews } from "@/lib/reviews";

/** `output: "export"` ではビルド時に sitemap を書き出す必要がある */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const reviews = getAllReviews();
  const BASE_URL = canonicalSiteUrl();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/start/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/about/`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.45,
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
    {
      url: `${BASE_URL}/welcome/tiktok/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/welcome/youtube/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/beginner/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/listening-environment/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/articles/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/r18/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/all-ages/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/works/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${BASE_URL}/all-ages/works/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/knowledge/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/featured/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.65,
    },
    {
      url: `${BASE_URL}/voice-actors/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/evaluation-method/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const reviewEntries: MetadataRoute.Sitemap = reviews.map((r) => ({
    url: `${BASE_URL}/reviews/${r.slug}/`,
    lastModified: new Date(articlePublishedTimeIso(r)),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticEntries, ...reviewEntries];
}
