import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { analyticsViewer } from "@/lib/analytics/guard";
import { buildWebAnalyticsReport } from "@/lib/analytics/report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const who = await analyticsViewer();
  if (!who) return new NextResponse("Not allowed.", { status: 403 });
  const r = await buildWebAnalyticsReport(new URL(req.url).searchParams.get("month"), who);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 40;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const clean = (t: string) => t.replace(/[^\x20-\x7E]/g, "?");
  const line = (text: string, o: { size?: number; bold?: boolean; right?: string } = {}) => {
    if (y < M + 14) { page = doc.addPage([W, H]); y = H - M; }
    const size = o.size ?? 10;
    const f = o.bold ? bold : font;
    let t = clean(text);
    const maxW = W - 2 * M - (o.right ? 90 : 0);
    while (t.length > 3 && f.widthOfTextAtSize(t, size) > maxW) t = t.slice(0, -4) + "...";
    page.drawText(t, { x: M, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    if (o.right) page.drawText(clean(o.right), { x: W - M - f.widthOfTextAtSize(clean(o.right), size), y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
    y -= size + 4;
  };
  const head = (t: string) => { y -= 8; line(t, { size: 12, bold: true }); };
  line("The Good Child Bookstore - Website analytics", { size: 16, bold: true });
  line(`${r.monthLabel}. Counts only visitors who accepted analytics, on the live site.`);
  if (!r.hasData) line("No visits have been recorded for this month.");
  head("Totals");
  line("Page views", { right: String(r.totals.pageViews) }); line("Visits", { right: String(r.totals.visits) }); line("Book views", { right: String(r.totals.bookViews) });
  line("Added to cart", { right: String(r.totals.addToCart) }); line("Checkout started", { right: String(r.totals.checkoutStarted) }); line("Purchases", { right: String(r.totals.purchases) });
  if (r.totals.revenue !== null) line("Revenue from those purchases (USD)", { right: r.totals.revenue.toFixed(2) });
  head("Top pages"); r.topPages.forEach((p) => line(p.path, { right: String(p.views) }));
  head("Top blog posts"); r.topBlogPosts.forEach((p) => line(p.title, { right: String(p.views) }));
  head("Top books"); r.topBooks.forEach((p) => line(p.title, { right: String(p.views) }));
  head("Traffic sources"); r.sources.forEach((p) => line(p.source, { right: String(p.visits) }));
  head("Blog to book to sale");
  r.blogConversion.forEach((b) => line(`${b.title}: ${b.clicksToBooks} clicks, ${b.bookViews} book views, ${b.addToCart} carts, ${b.checkouts} checkouts, ${b.purchases} purchases${b.revenue !== null ? `, USD ${b.revenue.toFixed(2)}` : ""}`));
  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="website-analytics-${r.month}.pdf"`, "Cache-Control": "no-store" } });
}
