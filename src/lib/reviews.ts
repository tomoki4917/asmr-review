import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { cache } from "react";
import type {
  AffiliateLink,
  AffiliateVendor,
  Review,
  ReviewContentKind,
} from "./types";

/** Markdown のルート（直下の .md は走査しない。`レビュー/` と `記事/` のみ対象） */
const CONTENT_DIR = path.join(process.cwd(), "src", "content");

/** 走査対象: 各フォルダ内に「タイトル用サブフォルダ/index.md」または .md を配置 */
const CONTENT_MARKDOWN_ROOTS = ["レビュー", "記事"] as const;

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

function parseOptionalNextSlug(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.trim();
}

function parseOptionalCoverAffiliateHref(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const s = raw.trim();
  if (s.startsWith("http://") || s.startsWith("https://")) {
    return s;
  }
  throw new Error(
    'coverAffiliateHref は http(s) の URL を指定してください。'
  );
}

function parseContentKind(raw: unknown): ReviewContentKind {
  if (raw === "article") return "article";
  return "review";
}

function parseReviewFile(source: string, fallbackSlug: string): Review {
  const { data, content } = matter(source);
  const d = data as Record<string, unknown>;

  const slug =
    typeof d.slug === "string" && d.slug.trim() ? d.slug.trim() : fallbackSlug;
  const contentKind = parseContentKind(d.contentKind ?? d.kind);
  const titleStr = asString(d.title, "title");

  let ratingValue = 0;
  let ratingBest: number | undefined;
  if (contentKind === "review") {
    ratingValue = asNumber(d.ratingValue, "ratingValue");
    ratingBest =
      d.ratingBest != null ? asNumber(d.ratingBest, "ratingBest") : undefined;
  }

  const itemName =
    typeof d.itemName === "string" && d.itemName.trim()
      ? d.itemName.trim()
      : titleStr;

  const review: Review = {
    slug,
    contentKind,
    title: titleStr,
    summary: asString(d.summary, "summary"),
    tags: asStringArray(d.tags, "tags"),
    body: typeof content === "string" ? content.replace(/\r\n/g, "\n").trim() : "",
    coverImage: parseOptionalCoverImage(d.coverImage),
    coverAffiliateHref: parseOptionalCoverAffiliateHref(d.coverAffiliateHref),
    ratingValue,
    ratingBest,
    itemName,
    itemDescription:
      typeof d.itemDescription === "string" && d.itemDescription.trim()
        ? d.itemDescription.trim()
        : undefined,
    authorName: asString(d.authorName, "authorName"),
    publishedAt: asString(d.publishedAt, "publishedAt"),
    affiliateLinks: parseAffiliateLinks(d.affiliateLinks),
    nextSlug: parseOptionalNextSlug(d.nextSlug),
    workImpressionAvatar: parseOptionalCoverImage(d.workImpressionAvatar),
  };

  if (Number.isNaN(Date.parse(review.publishedAt))) {
    throw new Error(
      `publishedAt が日付として解釈できません: ${review.publishedAt}`
    );
  }

  return review;
}

/** レビューではなくフォルダ説明用の Markdown（README など） */
const DOC_MARKDOWN_NAMES = new Set([
  "readme.md",
  "changelog.md",
  "contributing.md",
  "license.md",
]);

function isReviewMarkdownFile(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  if (!base.endsWith(".md") || base.startsWith("_")) return false;
  if (DOC_MARKDOWN_NAMES.has(base)) return false;
  return true;
}

/** 1 ディレクトリ以下の .md を再帰収集（`_` 始まり・README 等は除外） */
function collectMarkdownUnder(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = ent.name;
    if (name === "." || name === "..") continue;
    const full = path.join(dir, name);
    if (ent.isDirectory()) {
      out.push(...collectMarkdownUnder(full));
    } else if (ent.isFile() && isReviewMarkdownFile(full)) {
      out.push(full);
    }
  }
  return out;
}

/** `レビュー/` と `記事/` 以下のみ走査（ルート直下の .md は対象外） */
function listAllReviewMarkdownFiles(): string[] {
  const out: string[] = [];
  for (const sub of CONTENT_MARKDOWN_ROOTS) {
    out.push(...collectMarkdownUnder(path.join(CONTENT_DIR, sub)));
  }
  return out;
}

/**
 * フロントに slug 未指定のときの既定値。
 * `記事/foo/index.md` → `foo`、それ以外はパスを `-` つなぎ。
 */
function fallbackSlugFromPath(filePath: string): string {
  const rel = path.relative(CONTENT_DIR, filePath);
  const normalized = rel.replace(/\\/g, "/").replace(/\.md$/i, "");
  const parts = normalized.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last.toLowerCase() === "index" && parts.length >= 2) {
    return parts[parts.length - 2]!;
  }
  return normalized.replace(/\//g, "-");
}

function readReviewFiles(): Review[] {
  const paths = listAllReviewMarkdownFiles();
  const reviews: Review[] = [];

  for (const filePath of paths) {
    const raw = fs.readFileSync(filePath, "utf8");
    const fallbackSlug = fallbackSlugFromPath(filePath);

    try {
      reviews.push(parseReviewFile(raw, fallbackSlug));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const rel = path.relative(CONTENT_DIR, filePath);
      throw new Error(`レビューの読み込みに失敗しました: ${rel}\n${msg}`);
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
  return getAllReviews()
    .filter((r) => r.contentKind === "review")
    .map((r) => ({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      tags: r.tags,
    }));
}
