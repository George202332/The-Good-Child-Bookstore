import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Stateless, signed unsubscribe token — no separate token record
 * needed. HMAC-signed with a server-only secret, so it can't be forged
 * to unsubscribe someone else, but needs no database round trip to
 * generate (only to verify, when actually clicked). */
function unsubscribeSecret(): string {
  return process.env.SETTINGS_ENCRYPTION_KEY ?? process.env.AUTH_SECRET ?? "fallback-unsubscribe-secret";
}

function signUserId(userId: string): string {
  return createHmac("sha256", unsubscribeSecret()).update(userId).digest("hex");
}

export function getUnsubscribeUrl(userId: string): string {
  const sig = signUserId(userId);
  return `${getSiteUrl()}/unsubscribe?u=${userId}&sig=${sig}`;
}

/** Verifies an unsubscribe link's signature and flips marketingOptIn
 * off. Never throws on a bad/forged link — just reports failure, so
 * the unsubscribe page can show a clear message either way. */
export async function processUnsubscribe(userId: string, sig: string): Promise<{ ok: boolean; error?: string }> {
  if (signUserId(userId) !== sig) return { ok: false, error: "This unsubscribe link isn't valid." };
  await prisma.user.update({ where: { id: userId }, data: { marketingOptIn: false } }).catch(() => {});
  return { ok: true };
}

/**
 * Sends a marketing email to every opted-in reader — opt-in only, per
 * explicit instruction (marketingOptIn defaults to false and is never
 * flipped on by anything other than the reader's own explicit choice
 * in Settings). Every send includes a real, working unsubscribe link
 * specific to that recipient.
 *
 * Sends sequentially with a small stagger rather than Promise.all —
 * deliberately avoids bursting the email provider's rate limit on a
 * list of any real size.
 */
export async function sendMarketingEmail(subject: string, bodyHtml: string): Promise<{ sent: number; failed: number }> {
  const recipients = await prisma.user.findMany({
    where: { marketingOptIn: true, role: "READER" },
    select: { id: true, email: true, name: true },
  });

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const unsubscribeUrl = getUnsubscribeUrl(recipient.id);
    const html = `
      ${bodyHtml}
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
      <p style="color: #999; font-size: 11px;">
        You're receiving this because you opted in to marketing emails from The Good Child Bookstore.
        <a href="${unsubscribeUrl}">Unsubscribe</a>
      </p>
    `;
    const result = await sendEmail(recipient.email, subject, html);
    if (result.ok) sent++;
    else failed++;
  }

  return { sent, failed };
}
