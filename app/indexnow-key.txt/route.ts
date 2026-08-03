import { NextResponse } from "next/server";
import { getOrCreateIndexNowKey } from "@/lib/indexnow";

/** Serves the IndexNow verification key as plain text — this exact
 * URL is what's passed as keyLocation on every IndexNow submission. */
export async function GET() {
  const key = await getOrCreateIndexNowKey();
  return new NextResponse(key, { headers: { "Content-Type": "text/plain" } });
}
