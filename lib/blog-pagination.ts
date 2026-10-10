/** Blog listing: 3 cards per row × 5 rows = 15 posts per page. */
export const BLOG_PAGE_SIZE = 15;

/** Turns the raw ?page= value into a safe whole number >= 1. */
export function parsePageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function totalPagesFor(totalPosts: number, pageSize: number = BLOG_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, totalPosts) / pageSize));
}

/** Page numbers to show: always the first and last, the current page
 * and one on each side, with "gap" markers where pages are skipped. */
export function pageWindow(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set<number>([1, total, current - 1, current, current + 1]);
  const pages = Array.from(keep).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function blogListUrl(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/blog?${qs}` : "/blog";
}

/** Splits a search box value into words; every word must match the
 * post's title or its author's name ("jane doe" finds Jane Doe's posts). */
export function searchTerms(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 6);
}
