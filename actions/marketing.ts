"use server";

import { authAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getUnsubscribeUrl } from "@/lib/email/marketing";

/**
 * The admin mailing-list tool — send one email to a whole audience
 * (an opted-in reader marketing blast, every author, or every active
 * affiliate) or to a hand-picked list of specific people. This is the
 * "existing marketing email feature," expanded per George's request:
 * it used to only ever target opted-in readers; it now also covers
 * authors, affiliates, and arbitrary specific recipients, while still
 * keeping the original opt-in/unsubscribe behavior exactly as it was
 * for the reader-marketing audience specifically (that's still the
 * only audience anything here is capable of emailing without either
 * their own opt-in or an admin's one-by-one deliberate pick).
 *
 * Every send goes through lib/email.ts's sendEmail(), which wraps the
 * message in the shared branded template (lib/email/template.ts) —
 * so this tool, and every other transactional email in the app, all
 * look like they came from the same company.
 */

export type MailingAudience = "READER_OPTIN" | "AUTHOR" | "AFFILIATE" | "SPECIFIC";

async function requireAdminSession() {
  const session = await authAdmin();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export interface MailingAudienceCounts {
  readerOptIn: number;
  author: number;
  affiliate: number;
}

/** Recipient counts per broad audience, shown on the compose page so
 * an admin knows the actual reach before sending, not just guessing. */
export async function getMailingAudienceCounts(): Promise<MailingAudienceCounts> {
  const session = await requireAdminSession();
  if (!session) return { readerOptIn: 0, author: 0, affiliate: 0 };

  const [readerOptIn, author, affiliateRows] = await Promise.all([
    prisma.user.count({ where: { marketingOptIn: true, role: "READER" } }),
    prisma.user.count({ where: { role: "AUTHOR" } }),
    prisma.user.findMany({
      where: { affiliateProfile: { isNot: null } },
      select: { role: true, readerProfile: { select: { affiliateAccess: true } } },
    }),
  ]);

  const affiliate = affiliateRows.filter((u: { role: string; readerProfile: { affiliateAccess: boolean } | null }) =>
    u.role === "READER" ? u.readerProfile?.affiliateAccess !== false : true
  ).length;

  return { readerOptIn, author, affiliate };
}

export interface RecipientSearchResult {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Powers the "specific recipients" picker — a simple name/email search
 * across every account, any role, so an admin can put together an
 * arbitrary list (e.g. "these 3 authors who asked about X"). */
export async function searchMailingRecipients(query: string): Promise<RecipientSearchResult[]> {
  const session = await requireAdminSession();
  if (!session) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
    take: 15,
  });
  return users;
}

async function recipientsForAudience(
  audience: MailingAudience,
  specificUserIds: string[]
): Promise<{ id: string; email: string; name: string }[]> {
  if (audience === "READER_OPTIN") {
    return prisma.user.findMany({ where: { marketingOptIn: true, role: "READER" }, select: { id: true, email: true, name: true } });
  }
  if (audience === "AUTHOR") {
    return prisma.user.findMany({ where: { role: "AUTHOR" }, select: { id: true, email: true, name: true } });
  }
  if (audience === "AFFILIATE") {
    const withProfile = await prisma.user.findMany({
      where: { affiliateProfile: { isNot: null } },
      select: { id: true, email: true, name: true, role: true, readerProfile: { select: { affiliateAccess: true } } },
    });
    return withProfile
      .filter((u: { role: string; readerProfile: { affiliateAccess: boolean } | null }) => (u.role === "READER" ? u.readerProfile?.affiliateAccess !== false : true))
      .map((u: { id: string; email: string; name: string }) => ({ id: u.id, email: u.email, name: u.name }));
  }
  if (specificUserIds.length === 0) return [];
  return prisma.user.findMany({ where: { id: { in: specificUserIds } }, select: { id: true, email: true, name: true } });
}

/**
 * Sends one email to everyone in the chosen audience. Sequential, not
 * Promise.all, so a list of any real size doesn't burst the email
 * provider's rate limit. Only the READER_OPTIN audience gets an
 * unsubscribe link — it's the only one built from an opt-in flag in
 * the first place, so it's the only one that flag can turn back off.
 */
export async function sendMailingListBlast(
  audience: MailingAudience,
  specificUserIds: string[],
  subject: string,
  bodyHtml: string
): Promise<{ ok: boolean; sent?: number; failed?: number; error?: string }> {
  const session = await requireAdminSession();
  if (!session) return { ok: false, error: "Not authorized." };
  if (!subject.trim()) return { ok: false, error: "Subject is required." };
  if (!bodyHtml.trim()) return { ok: false, error: "Message body is required." };

  const recipients = await recipientsForAudience(audience, specificUserIds);
  if (recipients.length === 0) {
    return { ok: false, error: audience === "SPECIFIC" ? "Select at least one recipient." : "No recipients match that audience yet." };
  }

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const result = await sendEmail(
      recipient.email,
      subject.trim(),
      bodyHtml,
      undefined,
      undefined,
      audience === "READER_OPTIN" ? getUnsubscribeUrl(recipient.id) : undefined
    );
    if (result.ok) sent++;
    else failed++;
  }

  return { ok: true, sent, failed };
}
