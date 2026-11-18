import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendAutomaticMessage } from "@/lib/automatic-message";
import { setWorkflowStatus } from "@/lib/message-meta";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { buyerUpdateText, updateKindForStatus, type BuyerUpdateKind } from "@/lib/lulu-order-updates";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Claims "this update was sent for this order". True only for the first caller; every later or simultaneous call gets false. */
async function claim(orderId: string, kind: string): Promise<boolean> {
  try {
    const n = await prisma.$executeRaw(Prisma.sql`INSERT INTO "OrderUpdateSent" ("orderId", "kind") VALUES (${orderId}, ${kind}) ON CONFLICT DO NOTHING`);
    return n === 1;
  } catch {
    return false; // table not created yet: send nothing rather than risk sending twice
  }
}
async function release(orderId: string, kind: string): Promise<void> {
  try { await prisma.$executeRaw(Prisma.sql`DELETE FROM "OrderUpdateSent" WHERE "orderId" = ${orderId} AND "kind" = ${kind}`); } catch { /* ignore */ }
}

/**
 * Tells the buyer about a change in the print order, once. Called with Lulu's own status (already verified against Lulu by
 * the webhook, which asks Lulu directly). A repeated status or a second webhook finds the claim taken and does nothing.
 * Signed-in buyers get a Messages entry from Operations (tagged Automatic) AND an email; a guest who has not set up an account gets the email only.
 */
export async function notifyBuyerOfStatus(orderId: string, luluStatus: string, tracking: { url: string | null; id: string | null }): Promise<BuyerUpdateKind | null> {
  const kind = updateKindForStatus(luluStatus);
  if (!kind) return null;
  if (!(await claim(orderId, kind))) return null;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, reader: { select: { user: { select: { id: true, name: true, email: true, guestSetupPending: true } } } }, lines: { select: { format: true, book: { select: { title: true } } } } },
    });
    const user = order?.reader?.user;
    if (!order || !user) { await release(orderId, kind); return null; }
    const printTitles = order.lines.filter((l) => l.format === "paperback" || l.format === "hardcover").map((l) => l.book.title);
    const title = printTitles.length ? printTitles.join(", ") : order.lines.map((l) => l.book.title).join(", ");
    const orderNo = order.id.slice(-8).toUpperCase();
    const t = buyerUpdateText(kind, title, orderNo, tracking);
    if (!user.guestSetupPending) {
      const msgId = await sendAutomaticMessage(user.id, "OPERATIONS", t.subject, t.body);
      // Routine progress updates are information for Operations, not work: they are filed as Resolved. A hold stays New.
      if (msgId && kind !== "ON_HOLD") await setWorkflowStatus([msgId], "RESOLVED");
    }
    const link = kind === "SHIPPED" && tracking.url ? `<p><a href="${esc(tracking.url)}">Track your parcel</a></p>` : "";
    const sent = await sendEmail(
      user.email, `${t.subject}: ${title}`,
      `<p>Hi ${esc(user.name.split(/\s+/)[0] || "there")},</p><p style="white-space:pre-wrap;">${esc(t.body)}</p>${link}<p>Your orders are always listed at <a href="${getPublicSiteUrl()}/account/orders">${getPublicSiteUrl()}/account/orders</a>.</p>`
    );
    if (!sent.ok && !user.guestSetupPending) { /* the in-app message is the record; the email failing is not retried to avoid a duplicate message */ }
  } catch (e) {
    console.error("order update failed", e);
    await release(orderId, kind); // nothing reached the buyer, so a later status check may try again
  }
  return kind;
}
