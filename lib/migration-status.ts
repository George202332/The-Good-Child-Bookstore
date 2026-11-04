import { prisma } from "@/lib/prisma";
import expected from "@/lib/expected-migrations.json";

/**
 * Is the connected database behind the code? The code knows which migrations it needs (lib/expected-migrations.json, rewritten before
 * every build). Prisma records every migration it has applied in the table _prisma_migrations. If the code needs one the database
 * has not applied, the database is "behind" and features that use the new columns fail (for example checkout error P2022).
 * Pure comparison first (tested), then the database read. Reads only; never changes anything; shows names only.
 */

export interface MigrationStatus {
  /** true = the database could be read. */
  checked: boolean;
  expectedCount: number;
  appliedCount: number;
  /** Migrations the code needs that the database has not (successfully) applied. */
  missing: string[];
  /** A migration that started but failed, if any (needs attention before anything else). */
  failed: string[];
  behind: boolean;
  error?: string;
}

export function compareMigrations(expectedNames: string[], applied: { name: string; finished: boolean; rolledBack: boolean }[]): Pick<MigrationStatus, "missing" | "failed" | "behind" | "expectedCount" | "appliedCount"> {
  const done = new Set(applied.filter((a) => a.finished && !a.rolledBack).map((a) => a.name));
  const failed = applied.filter((a) => !a.finished && !a.rolledBack).map((a) => a.name);
  const missing = expectedNames.filter((n) => !done.has(n));
  return { missing, failed, behind: missing.length > 0 || failed.length > 0, expectedCount: expectedNames.length, appliedCount: done.size };
}

let cache: { at: number; value: MigrationStatus } | null = null;

export async function getMigrationStatus(maxAgeMs = 60_000): Promise<MigrationStatus> {
  if (cache && Date.now() - cache.at < maxAgeMs) return cache.value;
  let value: MigrationStatus;
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    const c = compareMigrations(expected as string[], rows.map((r) => ({ name: r.migration_name, finished: !!r.finished_at, rolledBack: !!r.rolled_back_at })));
    value = { checked: true, ...c };
  } catch (e) {
    value = { checked: false, expectedCount: (expected as string[]).length, appliedCount: 0, missing: [], failed: [], behind: false, error: e instanceof Error ? e.message.split("\n").slice(-1)[0].slice(0, 200) : "unreadable" };
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Plain-words warning, or null when the database is up to date (or could not be read). */
export function migrationWarning(s: MigrationStatus): string | null {
  if (!s.checked || !s.behind) return null;
  const parts: string[] = [];
  if (s.missing.length) parts.push(`${s.missing.length} database update${s.missing.length === 1 ? "" : "s"} not applied yet (${s.missing.join(", ")})`);
  if (s.failed.length) parts.push(`a database update failed part-way (${s.failed.join(", ")})`);
  return `The database is BEHIND this version of the site: ${parts.join("; ")}. Some pages, such as checkout, may fail until you run "npx prisma migrate deploy" against this environment's database.`;
}
