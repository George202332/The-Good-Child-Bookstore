import type { NextRequest } from "next/server";
import { adminHandlers } from "@/lib/auth-admin";
import { stripCookiePersistence } from "@/lib/session-cookie";

/** Same treatment as app/api/auth/[...nextauth]/route.ts, for the
 * independent backend session cookie — see lib/session-cookie.ts. */
export async function GET(request: NextRequest): Promise<Response> {
  return stripCookiePersistence(await adminHandlers.GET(request), "gcb-admin-session-token");
}

export async function POST(request: NextRequest): Promise<Response> {
  return stripCookiePersistence(await adminHandlers.POST(request), "gcb-admin-session-token");
}
