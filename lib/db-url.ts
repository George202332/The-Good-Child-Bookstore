/**
 * Database address tuning, in one pure place.
 *
 * On Vercel every page can run in its own short-lived server function, and each one opens its own database connections.
 * Neon's "pooled" address (its host name contains "-pooler") puts a connection pooler (PgBouncer) in front of the database so
 * thousands of short functions share a small number of real connections. Prisma needs two extra settings to work through it:
 * `pgbouncer=true` (it must not use named prepared statements) and a small `connection_limit` per function.
 *
 * Migrations must NOT go through the pooler: scripts/migrate-*.ps1 already swap the pooled host for the direct one.
 * Nothing here changes the schema or the stored address; it only adds those two settings in memory when they are missing.
 */
export function tunedDatabaseUrl(raw: string | undefined, env: Record<string, string | undefined> = process.env): string | undefined {
  if (!raw) return raw;
  let u: URL;
  try { u = new URL(raw); } catch { return raw; }
  const pooled = /-pooler\./i.test(u.hostname);
  if (pooled && !u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
  // One function instance rarely needs more than a few connections; the pooler multiplexes the rest.
  if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", pooled || env.VERCEL ? "5" : "10");
  if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "15");
  if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
  return u.toString();
}

export const isPooledUrl = (raw: string | undefined): boolean => !!raw && /-pooler\./i.test(raw);
