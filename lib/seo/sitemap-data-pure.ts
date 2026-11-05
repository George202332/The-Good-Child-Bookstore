/** One sitemap file holds at most this many addresses (the limit is 50,000; smaller files are quicker to read). */
export const SITEMAP_CHUNK = 1000;

export function chunk<T>(items: T[], size = SITEMAP_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out.length ? out : [[]];
}
