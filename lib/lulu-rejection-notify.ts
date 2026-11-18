import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { fixHint } from "@/lib/lulu-rejection";
import { sendAutomaticMessage } from "@/lib/automatic-message";
import { bookRefOf } from "@/lib/book-reference";
import { staffOfDepartment } from "@/lib/departments-server";
import { notifyBuyerOfStatus } from "@/lib/order-updates";

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

  type L = { format: string | null; book: { id: string; title: string; isbn: string | null; hasEbook: boolean; hasPrint: boolean; hasAudiobook: boolean; submissionMetadata: unknown; author: { user: { id: string; email: string; name: string } } } };
  const printLines = (order.lines as L[]).filter((l) => l.format === "paperback" || l.format === "hardcover");
  const byAuthor = new Map<string, { user: { id: string; email: string; name: string }; items: { bookId: string; title: string; format: string; sn: string }[] }>();
  for (const l of printLines) {
    const u = l.book.author.user;
    const entry = byAuthor.get(u.id) ?? { user: u, items: [] };
    entry.items.push({ bookId: l.book.id, title: l.book.title, format: l.format === "hardcover" ? "Hardcover" : "Paperback", sn: bookRefOf(l.book).sn });
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
    // Messages: from Operations, tagged Automatic, naming the book and SN, with the link to its print edit screen.
    for (const i of items) {
      await sendAutomaticMessage(
        user.id, "OPERATIONS", `Print file problem: ${i.title}`,
        `Lulu, our print partner, could not print "${i.title}" (${i.format}, SN ${i.sn}).\n\nWhat Lulu found: ${cleanReason}\n\nWhat to do: ${hint}\n\nOpen the print edit screen for this book: ${site}/account/books/${i.bookId}/edit?edition=print\n\nYour reader's order is on hold until the file is fixed. We will remind you every few days, and nothing is charged or refunded automatically.`,
        { id: i.bookId, title: i.title, sn: i.sn }
      );
    }
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
  // The back end: a notice for Operations (and admins), and the buyer is told their order is on hold.
  const titles = [...byAuthor.values()].flatMap((a) => a.items.map((i) => `${i.title} (SN ${i.sn})`)).join(", ");
  try {
    for (const staffId of await staffOfDepartment("OPERATIONS")) {
      await createNotification(staffId, `Lulu rejected a print file: order ${orderNo}`, `${titles}. Lulu's reason: ${cleanReason}`.slice(0, 300), "PRINT_REJECTED");
    }
  } catch { /* the author has already been told */ }
  await notifyBuyerOfStatus(orderId, "REJECTED", { url: null, id: null });
  return true;
}

/** Reminds the author of every still-rejected print file, at most once per `everyDays`. Safe to run often. */
export async function remindAuthorsOfRejections(everyDays: number, maxPerRun = 20): Promise<number> {
  const cutoff = new Date(Date.now() - Math.max(1, everyDays) * 86400000);
  // luluReminderAt comes from the newest migration, so it is read with raw SQL (it does not exist before the migration is run).
  let dueIds: string[] = [];
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM "Order" WHERE "luluRejectedAt" IS NOT NULL AND "luluAuthorNotifiedAt" IS NOT NULL AND "luluAuthorNotifiedAt" <= ${cutoff} AND ("luluReminderAt" IS NULL OR "luluReminderAt" <= ${cutoff}) LIMIT ${maxPerRun}`
    );
    dueIds = rows.map((r) => r.id);
  } catch { return 0; }
  const due: { id: string; luluRejectionReason: string | null; lines: { format: string | null; book: { id: string; title: string; isbn: string | null; hasEbook: boolean; hasPrint: boolean; hasAudiobook: boolean; submissionMetadata: unknown; author: { userId: string } } }[] }[] = [];
  for (const id of dueIds) {
    const o = await prisma.order.findUnique({
      where: { id },
      select: { id: true, luluRejectionReason: true, lines: { select: { format: true, book: { select: { id: true, title: true, isbn: true, hasEbook: true, hasPrint: true, hasAudiobook: true, submissionMetadata: true, author: { select: { userId: true } } } } } } },
    });
    if (o) due.push(o as never);
  }
  let sent = 0;
  const site = getPublicSiteUrl();
  for (const o of due) {
    // One statement claims the reminder, so two runs at the same moment cannot both send it.
    const claimed = await prisma.$executeRaw(Prisma.sql`UPDATE "Order" SET "luluReminderAt" = NOW() WHERE id = ${o.id} AND "luluRejectedAt" IS NOT NULL AND ("luluReminderAt" IS NULL OR "luluReminderAt" <= ${cutoff})`);
    if (claimed === 0) continue;
    for (const l of o.lines) {
      if (l.format !== "paperback" && l.format !== "hardcover") continue;
      const ref = bookRefOf(l.book);
      await sendAutomaticMessage(
        l.book.author.userId, "OPERATIONS", `Reminder: fix the print file for ${ref.title}`,
        `A reminder: the print file for "${ref.title}" (SN ${ref.sn}) is still waiting for a fix, and a reader's order is on hold until it is done.\n\nLulu's reason: ${o.luluRejectionReason ?? "see your earlier message"}\n\nOpen the print edit screen: ${site}/account/books/${ref.id}/edit?edition=print`,
        ref
      );
      sent++;
    }
  }
  return sent;
}
