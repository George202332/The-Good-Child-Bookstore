import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notifications";
import { sendEmail } from "@/lib/email";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { fixHint } from "@/lib/lulu-rejection";

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Records that Lulu turned a print job down and tells each affected author, ONCE.
 *
 * The "once" is enforced by a single database update that only succeeds while
 * luluAuthorNotifiedAt is still empty: whoever runs it first (a webhook, the refresh button,
 * the send step) wins, and every later call for the same rejection finds it already claimed
 * and does nothing. An explicit resend clears the claim, so a NEW rejection is told again.
 * Returns true only when this call sent the notices.
 */
export async function recordRejectionAndNotify(orderId: string, reason: string): Promise<boolean> {
  const cleanReason = reason.trim() || "Lulu did not give a reason.";
  const now = new Date();
  const claim = await prisma.order.updateMany({
    where: { id: orderId, luluAuthorNotifiedAt: null },
    data: { luluAuthorNotifiedAt: now, luluRejectedAt: now, luluRejectionReason: cleanReason.slice(0, 3800) },
  });
  if (claim.count === 0) return false;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: { include: { book: { include: { author: { include: { user: true } } } } } } },
  });
  if (!order) return true;

  type L = { format: string | null; book: { id: string; title: string; author: { user: { id: string; email: string; name: string } } } };
  const printLines = (order.lines as L[]).filter((l) => l.format === "paperback" || l.format === "hardcover");
  const byAuthor = new Map<string, { user: { id: string; email: string; name: string }; items: { bookId: string; title: string; format: string }[] }>();
  for (const l of printLines) {
    const u = l.book.author.user;
    const entry = byAuthor.get(u.id) ?? { user: u, items: [] };
    entry.items.push({ bookId: l.book.id, title: l.book.title, format: l.format === "hardcover" ? "Hardcover" : "Paperback" });
    byAuthor.set(u.id, entry);
  }

  const site = getPublicSiteUrl();
  const hint = fixHint(cleanReason);
  const orderNo = order.id.slice(-8).toUpperCase();
  for (const { user, items } of byAuthor.values()) {
    const what = items.map((i) => `"${i.title}" (${i.format})`).join(", ");
    await createNotification(
      user.id,
      `Lulu rejected your print file: ${items[0].title}`,
      `Lulu could not print ${what}. Lulu's reason: ${cleanReason} ${hint}`,
      "PRINT_REJECTED",
      items[0].bookId
    );
    const rows = items.map((i) => `<li><strong>${esc(i.title)}</strong> &mdash; ${i.format} (<a href="${site}/account/books/${i.bookId}/edit">open this book</a>)</li>`).join("");
    await sendEmail(
      user.email,
      `Action needed: Lulu rejected the print file for ${items[0].title}`,
      `<h2 style="margin:0 0 12px;">Lulu could not print your book</h2>
       <p>Hi ${esc(user.name.split(/\s+/)[0] || "there")},</p>
       <p>A printed copy ordered from The Good Child Bookstore (order ${orderNo}) was rejected by our print partner, Lulu.</p>
       <ul>${rows}</ul>
       <p><strong>The reason Lulu gave:</strong></p>
       <blockquote style="margin:0 0 14px;padding:10px 14px;background:#FFF1F0;border-left:4px solid #B3261E;">${esc(cleanReason)}</blockquote>
       <p><strong>What to do:</strong> ${esc(hint)}</p>
       <p>You will not be charged anything. We are sorry for the delay to your reader.</p>`
    );
  }
  return true;
}
