/** Endless tables: how many rows are visible after `loads` batches. Pure so it can be tested. */
export const ENDLESS_BATCH = 10;

export function visibleCount(total: number, loads: number, batch: number = ENDLESS_BATCH): number {
  return Math.min(total, Math.max(1, loads + 1) * batch);
}

export function hasMore(total: number, shown: number): boolean {
  return shown < total;
}
