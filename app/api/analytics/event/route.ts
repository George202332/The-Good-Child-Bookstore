import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyticsEnabledFor, parseConsent, sanitizeEvent } from "@/lib/analytics/policy";

/**
 * Receives one anonymous visit/funnel event. Stores it in the existing AnalyticsEvent table (no schema change).
 *  - Does nothing unless this is the live site (staging counts never mix with live), and the visitor's cookie says "granted".
 *  - Keeps only whitelisted short fields (see sanitizeEvent): no names, e-mails, IP addresses, user ids or order contents.
 *  - A purchase is checked against the real order (must exist and be PAID) and the amount comes from the order, never from the browser.
 * Always answers 204 quickly so a tracking problem can never affect shopping.
 */
export const runtime = "nodejs";

const NO = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  try {
    if (!analyticsEnabledFor()) return NO();
    if (parseConsent(req.headers.get("cookie")) !== "granted") return NO();
    const text = await req.text();
    if (text.length > 2000) return NO();
    const ev = sanitizeEvent(JSON.parse(text));
    if (!ev) return NO();
    const ua = (req.headers.get("user-agent") || "").toLowerCase();
    if (/bot|crawl|spider|slurp|headless|lighthouse|pagespeed/.test(ua)) return NO();

    if (ev.name === "purchase") {
      const orderId = String(ev.data.orderId);
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, totalAmount: true } });
      if (!order || order.status !== "PAID") return NO();
      const already = await prisma.analyticsEvent.findFirst({ where: { type: "purchase", metadata: { path: ["orderId"], equals: orderId } }, select: { id: true } });
      if (already) return NO();
      await prisma.analyticsEvent.create({ data: { type: "purchase", metadata: { ...ev.data, total: Number(order.totalAmount) } } });
      return NO();
    }
    await prisma.analyticsEvent.create({ data: { type: ev.name, metadata: ev.data } });
  } catch {
    /* tracking must never break the site */
  }
  return NO();
}
