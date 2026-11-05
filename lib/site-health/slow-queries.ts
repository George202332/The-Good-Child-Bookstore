/**
 * Keeps the slowest recent database queries in memory (per server instance), for the Site Health page.
 * Stores only the query text with its values shown as $1, $2 (Prisma never puts values in the text), the time it took and when.
 * Nothing is written to the database from here, so watching queries can never slow them down.
 */
export const SLOW_QUERY_MS = 800;
const MAX_KEPT = 25;

export interface SlowQuery { text: string; ms: number; at: number }
const g = globalThis as unknown as { __gcbSlow?: SlowQuery[] };

export function noteSlowQuery(query: string, ms: number): void {
  if (ms < SLOW_QUERY_MS) return;
  const list = (g.__gcbSlow ??= []);
  list.push({ text: query.replace(/\s+/g, " ").slice(0, 300), ms: Math.round(ms), at: Date.now() });
  if (list.length > MAX_KEPT) list.splice(0, list.length - MAX_KEPT);
}

export function recentSlowQueries(): SlowQuery[] {
  return [...(g.__gcbSlow ?? [])].sort((a, b) => b.ms - a.ms);
}
