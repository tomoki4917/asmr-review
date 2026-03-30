import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "asmr_admin_session";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function getSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    "asmr-review-dev-session-secret-change-in-production"
  );
}

export function createSessionToken(): string {
  const exp = Date.now() + MAX_AGE_MS;
  const sig = createHmac("sha256", getSessionSecret())
    .update(String(exp))
    .digest("hex");
  return `${exp}:${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || typeof token !== "string") return false;
  const colon = token.indexOf(":");
  if (colon <= 0) return false;
  const expStr = token.slice(0, colon);
  const sig = token.slice(colon + 1);
  const exp = Number(expStr);
  if (Number.isNaN(exp) || Date.now() > exp) return false;
  const expected = createHmac("sha256", getSessionSecret())
    .update(String(exp))
    .digest("hex");
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
