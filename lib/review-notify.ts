import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/email/purchase";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { titleKey } from "@/lib/book-groups";
import { isAwaitingReview } from "@/lib/revision-state";

/**
 * Server-only helpers for the reviewers (Admin, Editor, Chief Editor): the "Needs action" count and the e-mail that tells
 * them a book was posted or edited. On the staging site sendEmail() sends every message to the one test inbox only.
 */

export interface NeedsActionItem { id: string; title: string; kind: "posted" | "edited"; at: Date }

/** Books and edits waiting for a reviewer, one entry per title (the eBook/Audiobook and Print editions of a title count once). */
export async function listNeedsAction(): Promise<NeedsActionItem[]> {
  const rows = await prisma.book.findMany({
    where: { deletedByAuthorAt: null, OR: [{ status: "PENDING_REVIEW" }, { pendingRevisionData: { not: null as unknown as object } }] },
    select: { id: true, title: true, authorId: true, status: true, updatedAt: true, pendingRevisionData: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  const seen = new Map<string, NeedsActionItem>();
  for (const r of rows) {
    const posted = r.status === "PENDING_REVIEW";
    const edited = !posted && isAwaitingReview(r.pendingRevisionData);
    if (!posted && !edited) continue;
    const key = `${r.authorId}|${titleKey(r.title)}`;
    const prev = seen.get(key);
    // A title that has something new posted counts as "posted" even if another edition was only edited.
    if (!prev || (posted && prev.kind === "edited")) seen.set(key, { id: r.id, title: r.title, kind: posted ? "posted" : "edited", at: r.updatedAt });
  }
  return [...seen.values()];
}

export async function countNeedsAction(): Promise<number> {
  try { return (await listNeedsAction()).length; } catch { return 0; }
}

/** Tells every reviewer, by e-mail, that a book was posted or edited, with how many items need action now. Never throws. */
export async function notifyReviewers(kind: "posted" | "edited", bookTitle: string, bookId: string): Promise<void> {
  try {
    const [people, count] = await Promise.all([
      prisma.user.findMany({ where: { role: { in: ["ADMIN", "EDITOR", "CHIEF_EDITOR"] } }, select: { email: true } }),
      countNeedsAction(),
    ]);
    const subject = kind === "posted" ? "A new book has been posted" : "A book has been edited";
    const base = getPublicSiteUrl();
    const html = `<p><strong>${subject}:</strong> &ldquo;${escapeHtml(bookTitle)}&rdquo;</p>
<p>Needs action: <strong>${count}</strong> ${count === 1 ? "item is" : "items are"} waiting for review.</p>
<p><a href="${base}/admin/books/${encodeURIComponent(bookId)}/review">Open it for review</a> &middot; <a href="${base}/admin/books?status=PENDING_REVIEW">See everything that needs action</a></p>`;
    const emails = [...new Set(people.map((p: { email: string | null }) => p.email).filter((e: string | null): e is string => !!e))];
    await Promise.all(emails.map((to) => sendEmail(to, subject, html).catch(() => undefined)));
  } catch {
    // A failed reminder must never stop a book from being saved.
  }
}
