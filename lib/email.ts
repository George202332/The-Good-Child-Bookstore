import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { wrapEmailHtml } from "@/lib/email/template";

/**
 * Centralized transactional email sending — the single place every
 * email-sending code path in the app goes through. Uses the official
 * Resend Node SDK (`resend` package), not a raw HTTP call and not
 * SMTP/Nodemailer — this project has never used SMTP or Nodemailer
 * anywhere; this file (and the raw fetch() call it replaces) has
 * always talked to Resend, just via a manual HTTP request before this
 * change instead of the official client library.
 *
 * Authentication: the RESEND_API_KEY environment variable is the
 * fallback credential source, read at send time. An admin can also
 * override it from Admin → API Management → Email without touching
 * environment variables or redeploying — the same pattern already
 * used for every other third-party credential in this app (Paystack,
 * Wise, Lulu). If neither the database override nor RESEND_API_KEY is
 * set, sends are skipped with a clear, loggable reason rather than
 * throwing — a missing email configuration should never take down an
 * order confirmation or any other flow that calls this.
 *
 * From address: must be on a domain verified in the Resend dashboard
 * (Resend rejects sends from unverified domains), configured via the
 * FROM_EMAIL environment variable or the same Admin → API Management
 * override, defaulting to orders@thegoodchildbookstore.com.
 *
 * Every caller of sendEmail() in this project:
 *   - actions/order-emails.ts   — order confirmation/receipt (with PDF attachment)
 *   - actions/password-reset.ts — password reset link
 *   - actions/contact.ts        — contact form → support inbox
 *   - actions/messages.ts       — in-app message → support inbox notification
 *   - lib/email/verification.ts — account/author email verification link
 *   - actions/marketing.ts      — the admin mailing-list tool (by user type
 *                                 or specific recipients), including the
 *                                 opt-in-only reader marketing send
 *
 * Every one of those callers still only builds its own HTML fragment
 * (the message-specific content); this function wraps that fragment in
 * the shared branded template (lib/email/template.ts) before it's sent,
 * so every email leaving the platform — transactional or promotional —
 * looks like it came from the same company, with no per-caller styling
 * work required.
 */

async function getEmailCredentials(): Promise<{ apiKey?: string; fromEmail: string }> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "site_settings" } });
    const apiKeys = (setting?.value as { apiKeys?: { resendApiKey?: string; fromEmail?: string } } | undefined)?.apiKeys;
    return {
      apiKey: apiKeys?.resendApiKey?.trim() || process.env.RESEND_API_KEY,
      fromEmail: apiKeys?.fromEmail?.trim() || process.env.FROM_EMAIL || "orders@thegoodchildbookstore.com",
    };
  } catch {
    return { apiKey: process.env.RESEND_API_KEY, fromEmail: process.env.FROM_EMAIL || "orders@thegoodchildbookstore.com" };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachment?: { filename: string; content: Uint8Array },
  replyTo?: string,
  unsubscribeUrl?: string
): Promise<{ ok: boolean; error?: string }> {
  const { apiKey, fromEmail } = await getEmailCredentials();
  if (!apiKey) {
    console.log(`[email skipped — not configured] to=${to} subject="${subject}"`);
    return { ok: false, error: "Email isn't configured yet — set RESEND_API_KEY or add it in Admin \u2192 API Management \u2192 Email." };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html: wrapEmailHtml(html, { unsubscribeUrl }),
      ...(replyTo ? { replyTo } : {}),
      ...(attachment ? { attachments: [{ filename: attachment.filename, content: Buffer.from(attachment.content) }] } : {}),
    });

    if (error) {
      console.error("[Resend send failed] full error response:", JSON.stringify(error, null, 2));
      console.error("[Resend send failed] context:", { to, subject, from: fromEmail });
      return { ok: false, error: `Email send failed: ${error.name} — ${error.message}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[Resend send threw] full error:", e);
    console.error("[Resend send threw] context:", { to, subject, from: fromEmail });
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed." };
  }
}
