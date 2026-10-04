import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { stripCookiePersistence } from "@/lib/session-cookie";

/**
 * Wrapped (rather than just re-exporting `handlers` directly) so every
 * response that could set/refresh the session cookie — sign-in,
 * sign-out, and the session-check NextAuth does on each page load —
 * also gets its `gcb-session-token` cookie turned into a true
 * browser-session cookie. See lib/session-cookie.ts for why this can't
 * be done through NextAuth's own `cookies` config alone.
 */
export async function GET(request: NextRequest): Promise<Response> {
  return stripCookiePersistence(await handlers.GET(request), "gcb-session-token");
}

export async function POST(request: NextRequest): Promise<Response> {
  return stripCookiePersistence(await handlers.POST(request), "gcb-session-token");
}
