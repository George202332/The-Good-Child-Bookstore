import { prisma } from "@/lib/prisma";
import { recentSlowQueries, SLOW_QUERY_MS, type SlowQuery } from "@/lib/site-health/slow-queries";

/** Numbers for the Site Health "Capacity and speed" panel. Every figure is read from the database or from real recorded checks; a figure that
 * cannot be read is returned as null and shown as "not available", never guessed. */

export const CONNECTION_WARN_PERCENT = 80;
export const ERRORS_PER_HOUR_WARN = 20;
export const SLOW_CHECK_MS = 3000;

export interface Capacity {
  connections: { used: number; max: number; percent: number } | null;
  errorsLastHour: number | null;
  errorsLast24h: number | null;
  paidOrdersLast24h: number | null;
  responseTimes: { service: string; avgMs: number; p95Ms: number; samples: number }[];
  slowQueries: SlowQuery[];
  slowQueryLimitMs: number;
  warnings: string[];
}

export const percentile = (sorted: number[], p: number): number => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0);

export function capacityWarnings(c: Pick<Capacity, "connections" | "errorsLastHour" | "responseTimes">): string[] {
  const w: string[] = [];
  if (c.connections && c.connections.percent >= CONNECTION_WARN_PERCENT) w.push(`Database connections are ${c.connections.percent}% used (${c.connections.used} of ${c.connections.max}). Check that the live site uses the pooled address.`);
  if (c.errorsLastHour !== null && c.errorsLastHour >= ERRORS_PER_HOUR_WARN) w.push(`${c.errorsLastHour} errors were logged in the last hour.`);
  for (const r of c.responseTimes) if (r.p95Ms >= SLOW_CHECK_MS) w.push(`${r.service} is slow: 95% of its checks finished within ${r.p95Ms} ms.`);
  return w;
}

export async function readCapacity(): Promise<Capacity> {
  const safe = async <T,>(f: () => Promise<T>): Promise<T | null> => { try { return await f(); } catch { return null; } };
  const hourAgo = new Date(Date.now() - 3600_000), dayAgo = new Date(Date.now() - 24 * 3600_000);
  const [conn, errHour, errDay, paid, checks] = await Promise.all([
    safe(async () => {
      const r = await prisma.$queryRaw<{ used: bigint; max: string }[]>`SELECT (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()) AS used, current_setting('max_connections') AS max`;
      const used = Number(r[0].used), max = Number(r[0].max);
      return { used, max, percent: max > 0 ? Math.round((used / max) * 100) : 0 };
    }),
    safe(() => prisma.systemErrorLog.count({ where: { createdAt: { gte: hourAgo }, NOT: { message: { startsWith: "Capacity warning" } } } })),
    safe(() => prisma.systemErrorLog.count({ where: { createdAt: { gte: dayAgo }, NOT: { message: { startsWith: "Capacity warning" } } } })),
    safe(() => prisma.order.count({ where: { status: "PAID", createdAt: { gte: dayAgo } } })),
    safe(() => prisma.serviceCheck.findMany({ where: { checkedAt: { gte: dayAgo }, responseMs: { not: null } }, select: { service: true, responseMs: true }, take: 5000 })),
  ]);
  const by = new Map<string, number[]>();
  for (const c of checks ?? []) if (c.responseMs !== null) (by.get(c.service) ?? by.set(c.service, []).get(c.service)!).push(c.responseMs);
  const responseTimes = [...by.entries()].map(([service, v]) => {
    const s = [...v].sort((a, b) => a - b);
    return { service, avgMs: Math.round(s.reduce((x, y) => x + y, 0) / s.length), p95Ms: percentile(s, 95), samples: s.length };
  }).sort((a, b) => b.p95Ms - a.p95Ms);
  const base = { connections: conn, errorsLastHour: errHour, errorsLast24h: errDay, paidOrdersLast24h: paid, responseTimes, slowQueries: recentSlowQueries().slice(0, 10), slowQueryLimitMs: SLOW_QUERY_MS };
  return { ...base, warnings: capacityWarnings(base) };
}
