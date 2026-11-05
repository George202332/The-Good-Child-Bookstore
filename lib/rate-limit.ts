import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/geo";

/**
 * Rate limiting that works across all server instances: one small counter row per (rule, visitor, time window) in the
 * database (table RateLimitBucket). The visitor part is a short hash, so no IP address is stored.
 *
 * It is applied only to the places a bot would hammer (login, search, reviews, shipping quotes), never to ordinary page
 * views, so Google, Bing and other search crawlers (which only read pages) are never counted or blocked.
 * If the database cannot be reached the limiter lets the request through: it must never lock real customers out.
 */

import { RULES, windowStartOf, shortHash, type Rule } from "@/lib/rate-limit-core";
export { RULES, windowStartOf, shortHash, type Rule };

export interface LimitResult { ok: boolean; count: number; retryAfterSeconds: number }

export async function rateLimit(rule: Rule, who: string | null | undefined, nowMs: number = Date.now()): Promise<LimitResult> {
  const windowStart = windowStartOf(nowMs, rule.windowSeconds);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + rule.windowSeconds * 1000 - nowMs) / 1000));
  try {
    const key = `${rule.name}:${shortHash(who || "unknown")}`;
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitBucket" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
      RETURNING "count"`;
    const count = Number(rows[0]?.count ?? 1);
    return { ok: count <= rule.limit, count, retryAfterSeconds };
  } catch {
    return { ok: true, count: 0, retryAfterSeconds };
  }
}

/** Limits by the caller's network address. */
export async function rateLimitByIp(rule: Rule, extra = ""): Promise<LimitResult> {
  return rateLimit(rule, `${(await getRequestIp()) ?? "unknown"}|${extra}`);
}

/** Deletes counters older than a day. Called by the scheduled order-retry job. */
export async function purgeOldBuckets(): Promise<void> {
  try {
    await prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "windowStart" < ${new Date(Date.now() - 24 * 3600 * 1000)}`;
  } catch { /* table may not exist yet */ }
}
