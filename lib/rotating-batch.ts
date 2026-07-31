/**
 * Picks a "page" of items that rotates automatically over real time,
 * instead of a scrollable carousel — used for Best Sellers and New
 * Arrivals on the homepage. If there are more items than fit in one
 * batch, which batch shows changes every `rotateMs` milliseconds.
 */
export function getRotatingBatch<T>(items: T[], batchSize: number, rotateMs: number): T[] {
  const totalBatches = Math.max(1, Math.ceil(items.length / batchSize));
  const rotationIndex = Math.floor(Date.now() / rotateMs) % totalBatches;
  return items.slice(rotationIndex * batchSize, rotationIndex * batchSize + batchSize);
}
