import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { cache } from "react";
import { DEFAULT_WORK_IMPRESSION_AVATAR_SRC } from "./default-work-impression-avatar";
import { reviewPublicationTimeMs } from "./format-published-at";
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

/** DLsite 商品 ID（例 RJ01517030） */
function parseOptionalDlsiteProductId(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const s = raw.trim().toUpperCase();
  if (!/^RJ\d+$/.test(s)) {
    throw new Error(`dlsiteProductId は RJ + 数字の形式にしてください: ${raw}`);
  }
  return s;
}

const GO_LIVE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `goLiveAt` の開始瞬間（ms）。`YYYY-MM-DD` のときは UTC 0:00 開始。
 * ISO 日時のときは `Date.parse`（タイムゾーン付き推奨。例: `2026-04-18T13:59:00+09:00`）。
 */
function goLiveStartMs(goLiveAt: string): number {
  const s = goLiveAt.trim();
  if (GO_LIVE_DATE_RE.test(s)) {
    return Date.parse(`${s}T00:00:00.000Z`);
  }
  return Date.parse(s);
}

/** 作品販売日（暦日のみ）。`publishedAt` と同じ `YYYY-MM-DD` 形式。 */
function parseOptionalSaleDate(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const s = raw.trim();
  if (!GO_LIVE_DATE_RE.test(s)) {
    throw new Error(
      `saleDate は YYYY-MM-DD のみ指定してください（作品の販売開始日）: ${s}`
    );
  }
  const t = Date.parse(`${s}T00:00:00.000Z`);
  if (Number.isNaN(t)) {
    throw new Error(`saleDate が日付として解釈できません: ${s}`);
  }
  return s;
}

function parseOptionalCircleName(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.trim();
}

/**
 * `goLiveAt: "YYYY-MM-DD"` … その日の UTC 午前0時から公開。
 * または ISO 8601 日時（日本時間なら `...+09:00` を推奨）。
 */
function parseOptionalGoLiveAt(raw: unknown): string | undefined {
  if (raw == null || raw === "") return undefined;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const s = raw.trim();
  if (GO_LIVE_DATE_RE.test(s)) {
    const t = Date.parse(`${s}T00:00:00.000Z`);
    if (Number.isNaN(t)) {
      throw new Error(`goLiveAt が日付として解釈できません: ${s}`);
    }
    return s;
  }
  const t = goLiveStartMs(s);
  if (Number.isNaN(t)) {
    throw new Error(
      `goLiveAt は YYYY-MM-DD、または解釈可能な ISO 8601 日時（例: 2026-04-18T13:59:00+09:00）にしてください: ${s}`
    );
  }
  return s;
}

/** 現在時刻が goLiveAt 以降なら true（未指定なら常に true） */
function isReviewVisibleByGoLiveAt(review: Review, now: Date): boolean {
  if (!review.goLiveAt?.trim()) return true;
  const start = goLiveStartMs(review.goLiveAt.trim());
  if (Number.isNaN(start)) return true;
  return now.getTime() >= start;
}

/**
 * 一覧・サイトマップ・本文公開可否。`applyGoLiveFilter` と同じルール。
 *
 * - `REVIEW_IGNORE_GO_LIVE` … 常に公開扱い。
 * - `REVIEW_RESPECT_GO_LIVE` … dev / `next start` でも goLive を厳密に適用。
 * - それ以外で **`npm run dev` / `npm run start`**（`npm_lifecycle_event` が dev または start）や
 *   **`NODE_ENV===development`** のときは、検証用サーバーとして **goLive 前も表示**（静的 `out` の
 *   `npm run build` フェーズでは lifecycle が build のためこの扱いにならない）。
 * - Docker 等で `npm` が無いときは `REVIEW_PREVIEW_SERVER=true`。
 */
export function isReviewVisibleOnSite(review: Review, now: Date): boolean {
  const forceShowAll =
    process.env.REVIEW_IGNORE_GO_LIVE === "1" ||
    process.env.REVIEW_IGNORE_GO_LIVE === "true";
  if (forceShowAll) return true;

  const respectGoLive =
    process.env.REVIEW_RESPECT_GO_LIVE === "1" ||
    process.env.REVIEW_RESPECT_GO_LIVE === "true";

  if (!respectGoLive) {
    if (process.env.NODE_ENV === "development") return true;
    const ev = process.env.npm_lifecycle_event;
    if (ev === "dev" || ev === "start") return true;
    if (
      process.env.REVIEW_PREVIEW_SERVER === "1" ||
      process.env.REVIEW_PREVIEW_SERVER === "true"
    ) {
      return true;
    }
  }

  return isReviewVisibleByGoLiveAt(review, now);
}

/**
 * 予約投稿（goLiveAt）の除外。
 * - **`npm run build`（静的 `out`）** … ビルド時刻で goLive を判定（従来どおり）。
 * - **`npm run dev` / `npm run start`** … 既定では goLive 前も一覧に出す（`isReviewVisibleOnSite` 参照）。
 * - 開発・起動時も予約と同じ除外を試す: `REVIEW_RESPECT_GO_LIVE=true`
 * - 常に全件: `REVIEW_IGNORE_GO_LIVE=true`
 */
function applyGoLiveFilter(reviews: Review[]): Review[] {
  const now = new Date();
  return reviews.filter((r) => isReviewVisibleOnSite(r, now));
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
  const titleStr = asString(d.title, "title").replace(/\r\n/g, "\n").trim();

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

  const parsedWorkImpressionAvatar = parseOptionalCoverImage(d.workImpressionAvatar);
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
    saleDate: parseOptionalSaleDate(d.saleDate),
    circleName: parseOptionalCircleName(d.circleName),
    publishedAt: asString(d.publishedAt, "publishedAt"),
    goLiveAt: parseOptionalGoLiveAt(d.goLiveAt),
    affiliateLinks: parseAffiliateLinks(d.affiliateLinks),
    nextSlug: parseOptionalNextSlug(d.nextSlug),
    workImpressionAvatar:
      parsedWorkImpressionAvatar ??
      (contentKind === "review" ? DEFAULT_WORK_IMPRESSION_AVATAR_SRC : undefined),
    dlsiteProductId: parseOptionalDlsiteProductId(d.dlsiteProductId),
    safeForExternalLanding: d.safeForExternalLanding === true ? true : undefined,
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

/** ディスク上の全 Markdown（`goLiveAt` による除外なし・並びのみ） */
function readAllReviewsSorted(): Review[] {
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
    (a, b) => reviewPublicationTimeMs(b) - reviewPublicationTimeMs(a)
  );
}

/** 予約中の記事も含む全件（静的ルート生成・slug 解決用） */
export const getAllReviewsIncludingScheduled = cache((): Review[] =>
  readAllReviewsSorted()
);

export const getAllReviews = cache((): Review[] =>
  applyGoLiveFilter(getAllReviewsIncludingScheduled())
);

/** SNS 流入ページ用。`safeForExternalLanding: true` の記事のみ（フロントマターで明示） */
export function getReviewsForExternalLanding(): Review[] {
  return getAllReviews().filter((r) => r.safeForExternalLanding === true);
}

/** トップ「催眠音声入門」と同じ 3 本（存在する slug のみ・この順） */
const BEGINNER_GUIDE_SLUGS = [
  "hypnosis-mechanism-01",
  "nou-iki-toha",
  "dry-orgasm-what-is",
] as const;

export function getBeginnerGuides(): Review[] {
  const all = getAllReviews();
  return BEGINNER_GUIDE_SLUGS.map((slug) => all.find((r) => r.slug === slug)).filter(
    (r): r is Review => r != null
  );
}

export function getReviewBySlug(slug: string): Review | undefined {
  return getAllReviewsIncludingScheduled().find((r) => r.slug === slug);
}

export function getAllSlugs(): string[] {
  return getAllReviewsIncludingScheduled().map((r) => r.slug);
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
