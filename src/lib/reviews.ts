import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { cache } from "react";
import type { AffiliateLink, AffiliateVendor, Review } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "src", "content");

function isAffiliateVendor(v: unknown): v is AffiliateVendor {
  return v === "dlsite" || v === "amazon";
}

function parseAffiliateLinks(raw: unknown): AffiliateLink[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new Error("affiliateLinks は配列にしてください。");
  }
  return raw.map((item, i) => {
    if (!item || typeof item !== "object") {
      throw new Error(`affiliateLinks[${i}] が不正です。`);
    }
    const o = item as Record<string, unknown>;
    if (!isAffiliateVendor(o.vendor)) {
      throw new Error(
        `affiliateLinks[${i}].vendor は "dlsite" または "amazon" にしてください。`
      );
    }
    if (typeof o.href !== "string" || !o.href.trim()) {
      throw new Error(`affiliateLinks[${i}].href に有効な URL を指定してください。`);
    }
    const link: AffiliateLink = { vendor: o.vendor, href: o.href.trim() };
    if (typeof o.label === "string" && o.label.trim()) link.label = o.label.trim();
    if (typeof o.badgeText === "string" && o.badgeText.trim()) {
      link.badgeText = o.badgeText.trim();
    }
    return link;
  });
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} は非空の文字列で指定してください。`);
  }
  return value.trim();
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} は1件以上の文字列配列にしてください。`);
  }
  return value.map((v, i) => {
    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`${field}[${i}] が空です。`);
    }
    return v.trim();
  });
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${field} は数値にしてください。`);
  }
  return value;
}

function parseOptionalCoverImage(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const s = raw.trim();
  if (s.startsWith("/") || s.startsWith("http://") || s.startsWith("https://")) {
    return s;
  }
  throw new Error(
    'coverImage は "/" で始まる public パス、または http(s) URL を指定してください。'
  );
}

function parseReviewFile(source: string, fallbackSlug: string): Review {
  const { data, content } = matter(source);
  const d = data as Record<string, unknown>;

  const slug =
    typeof d.slug === "string" && d.slug.trim() ? d.slug.trim() : fallbackSlug;

  const review: Review = {
    slug,
    title: asString(d.title, "title"),
    summary: asString(d.summary, "summary"),
    tags: asStringArray(d.tags, "tags"),
    body: typeof content === "string" ? content.replace(/\r\n/g, "\n").trim() : "",
    coverImage: parseOptionalCoverImage(d.coverImage),
    ratingValue: asNumber(d.ratingValue, "ratingValue"),
    ratingBest:
      d.ratingBest != null ? asNumber(d.ratingBest, "ratingBest") : undefined,
    itemName: asString(d.itemName, "itemName"),
    itemDescription:
      typeof d.itemDescription === "string" && d.itemDescription.trim()
        ? d.itemDescription.trim()
        : undefined,
    authorName: asString(d.authorName, "authorName"),
    publishedAt: asString(d.publishedAt, "publishedAt"),
    affiliateLinks: parseAffiliateLinks(d.affiliateLinks),
  };

  if (Number.isNaN(Date.parse(review.publishedAt))) {
    throw new Error(
      `publishedAt が日付として解釈できません: ${review.publishedAt}`
    );
  }

  return review;
}

function readReviewFiles(): Review[] {
  if (!fs.existsSync(CONTENT_DIR)) {
    return [];
  }

  const names = fs.readdirSync(CONTENT_DIR);
  const reviews: Review[] = [];

  for (const name of names) {
    if (!name.endsWith(".md") || name.startsWith("_")) continue;

    const filePath = path.join(CONTENT_DIR, name);
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) continue;

    const raw = fs.readFileSync(filePath, "utf8");
    const fallbackSlug = path.basename(name, ".md");

    try {
      reviews.push(parseReviewFile(raw, fallbackSlug));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`レビューの読み込みに失敗しました: ${name}\n${msg}`);
    }
  }

  const bySlug = new Map<string, Review>();
  for (const r of reviews) {
    if (bySlug.has(r.slug)) {
      throw new Error(`slug が重複しています: "${r.slug}"`);
    }
    bySlug.set(r.slug, r);
  }

  return Array.from(bySlug.values()).sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );
}

export const getAllReviews = cache((): Review[] => readReviewFiles());

export function getReviewBySlug(slug: string): Review | undefined {
  return getAllReviews().find((r) => r.slug === slug);
}

export function getAllSlugs(): string[] {
  return getAllReviews().map((r) => r.slug);
}

/** Gemini 用に軽量な一覧（全文送信を避ける） */
export function getReviewsForRecommendation(): {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
}[] {
  return getAllReviews().map((r) => ({
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    tags: r.tags,
  }));
}
