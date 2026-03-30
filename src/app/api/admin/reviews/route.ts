import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifySessionToken,
} from "@/app/api/admin/_lib/session";
import {
  POST_KINDS,
  type PostedReview,
  type PostedReviewKind,
} from "@/lib/posted-review";

const MAX_TITLE = 200;
const MAX_SUMMARY = 2000;
const MAX_BODY = 80_000;
const MAX_TAG_LEN = 64;
const MAX_TAGS = 30;

function parsePostKind(v: unknown): PostedReviewKind {
  if (typeof v === "string" && POST_KINDS.includes(v as PostedReviewKind)) {
    return v as PostedReviewKind;
  }
  return "review";
}

function parseTags(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, MAX_TAGS)
      .map((t) => (t.length > MAX_TAG_LEN ? t.slice(0, MAX_TAG_LEN) : t));
  }
  if (typeof input === "string") {
    return input
      .split(/[,、]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, MAX_TAGS)
      .map((t) => (t.length > MAX_TAG_LEN ? t.slice(0, MAX_TAG_LEN) : t));
  }
  return [];
}

export async function POST(request: Request) {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json(
      { ok: false, error: "ログインの有効期限が切れたか、未認証です。" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "不正な JSON です。" }, { status: 400 });
  }

  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE) : "";
  const summary =
    typeof body.summary === "string"
      ? body.summary.trim().slice(0, MAX_SUMMARY)
      : "";
  const text =
    typeof body.body === "string" ? body.body.slice(0, MAX_BODY) : "";
  const tags = parseTags(body.tags);
  const postKind = parsePostKind(body.postKind);

  let ratingValue = 0;
  if (postKind === "review") {
    ratingValue = 4;
    if (typeof body.ratingValue === "number" && !Number.isNaN(body.ratingValue)) {
      ratingValue = Math.min(5, Math.max(1, Math.round(body.ratingValue)));
    }
  }

  if (!title) {
    return NextResponse.json(
      { ok: false, error: "タイトルを入力してください。" },
      { status: 400 }
    );
  }

  const review: PostedReview = {
    id: randomUUID(),
    postKind,
    title,
    summary: summary || title,
    body: text.trim(),
    tags,
    ratingValue,
    publishedAt: new Date().toISOString(),
  };

  return NextResponse.json({ ok: true, review });
}
