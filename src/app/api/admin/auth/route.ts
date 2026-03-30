import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
} from "@/app/api/admin/_lib/session";

function adminPassword(): string {
  return process.env.ADMIN_POST_PASSWORD ?? "Tomoki4917";
}

function safeEqualPassword(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function POST(request: Request) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "不正なリクエストです。" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!safeEqualPassword(password, adminPassword())) {
    return NextResponse.json(
      { ok: false, error: "パスワードが違います。" },
      { status: 401 }
    );
  }

  const token = createSessionToken();
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor((7 * 24 * 60 * 60)),
  });

  return NextResponse.json({ ok: true });
}
