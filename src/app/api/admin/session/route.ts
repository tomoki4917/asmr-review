import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  verifySessionToken,
} from "@/app/api/admin/_lib/session";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
  const ok = verifySessionToken(token);
  return NextResponse.json({ ok });
}
