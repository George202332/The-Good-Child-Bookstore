import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { getPublicSiteUrl as getSiteUrl } from "@/lib/seo/site-url";

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

// The actual mass-send logic (choosing recipients by audience —
// opted-in readers, all authors, active affiliates, or specific
// hand-picked people — and looping sendEmail() over them) now lives in
// actions/marketing.ts, as part of the admin mailing-list tool. This
// file keeps just the unsubscribe-link plumbing above, since
// app/unsubscribe/page.tsx and actions/marketing.ts both need it and
// neither is the right permanent home for it. The unsubscribe footer
// line itself is added by the shared branded template
// (lib/email/template.ts) whenever a send passes an unsubscribeUrl.
