/** Pure parts of the website analytics report (no database), so they can be tested alone. */
export const REPORT_UTC_OFFSET_HOURS = 3; // Nairobi, same as the rest of the back end

export function parseMonth(value: string | null | undefined, now = new Date()): { key: string; start: Date; end: Date; label: string } {
  const local = new Date(now.getTime() + REPORT_UTC_OFFSET_HOURS * 3600_000);
  let y = local.getUTCFullYear(), m = local.getUTCMonth();
  const mm = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value || "");
  if (mm) { y = Number(mm[1]); m = Number(mm[2]) - 1; }
  const start = new Date(Date.UTC(y, m, 1) - REPORT_UTC_OFFSET_HOURS * 3600_000);
  const end = new Date(Date.UTC(y, m + 1, 1) - REPORT_UTC_OFFSET_HOURS * 3600_000);
  const key = `${y}-${String(m + 1).padStart(2, "0")}`;
  const label = new Date(Date.UTC(y, m, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return { key, start, end, label };
}

/** The last 12 months, newest first, for the month picker. */
export function monthChoices(now = new Date()): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const local = new Date(now.getTime() + REPORT_UTC_OFFSET_HOURS * 3600_000);
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - i, 1));
    out.push({ key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) });
  }
  return out;
}

export interface WebAnalyticsReport {
  month: string;
  monthLabel: string;
  hasData: boolean;
  totals: { pageViews: number; visits: number; bookViews: number; addToCart: number; checkoutStarted: number; purchases: number; revenue: number | null };
  topPages: { path: string; views: number }[];
  topBlogPosts: { slug: string; title: string; views: number }[];
  topBooks: { bookId: string; title: string; views: number }[];
  sources: { source: string; visits: number }[];
  blogConversion: { slug: string; title: string; clicksToBooks: number; bookViews: number; addToCart: number; checkouts: number; purchases: number; revenue: number | null }[];
}

export function reportToCsv(r: WebAnalyticsReport): string {
  const q = (v: string | number | null) => { let s = v === null ? "" : String(v); if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows: (string | number | null)[][] = [
    ["Website analytics", r.monthLabel], [],
    ["Totals"], ["Page views", r.totals.pageViews], ["Visits", r.totals.visits], ["Book views", r.totals.bookViews], ["Added to cart", r.totals.addToCart], ["Checkout started", r.totals.checkoutStarted], ["Purchases", r.totals.purchases], ...(r.totals.revenue === null ? [] : [["Revenue (USD)", r.totals.revenue]]), [],
    ["Top pages"], ["Page", "Views"], ...r.topPages.map((p) => [p.path, p.views]), [],
    ["Top blog posts"], ["Post", "Views"], ...r.topBlogPosts.map((p) => [p.title, p.views]), [],
    ["Top books"], ["Book", "Views"], ...r.topBooks.map((p) => [p.title, p.views]), [],
    ["Traffic sources"], ["Source", "Visits"], ...r.sources.map((p) => [p.source, p.visits]), [],
    ["Blog to book to sale"], ["Post", "Clicks to books", "Book views", "Added to cart", "Checkout started", "Purchases", ...(r.totals.revenue === null ? [] : ["Revenue (USD)"])],
    ...r.blogConversion.map((b) => [b.title, b.clicksToBooks, b.bookViews, b.addToCart, b.checkouts, b.purchases, ...(b.revenue === null ? [] : [b.revenue])]),
  ];
  return rows.map((row) => row.map(q).join(",")).join("\r\n") + "\r\n";
}
