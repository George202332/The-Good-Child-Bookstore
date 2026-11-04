import { Resend } from "resend";
import { deploymentOf, emailRouteFor } from "@/lib/runtime-env";
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
 * Authentication: ONLY the RESEND_API_KEY Vercel variable, read at send
 * time (nothing is stored in the admin or the database any more). If it is
 * not set, sends are skipped with a clear, loggable reason rather than
 * throwing — a missing email configuration should never take down an
 * order confirmation or any other flow that calls this.
 *
 * Staging safety: on the staging (Preview) site nothing is ever sent to a
 * real recipient: every email goes only to otieno29@gmail.com with a
 * [STAGING] subject prefix. Only the live site (Production) sends to real people.
 *
 * From address: must be on a domain verified in the Resend dashboard
 * (Resend rejects sends from unverified domains), configured via the
 * FROM_EMAIL Vercel variable, defaulting to orders@thegoodchildbookstore.com.
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

function getEmailCredentials(): { apiKey?: string; fromEmail: string } {
  return {
    apiKey: process.env.RESEND_API_KEY?.trim() || undefined,
    fromEmail: process.env.FROM_EMAIL?.trim() || "orders@thegoodchildbookstore.com",
  };
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachment?: { filename: string; content: Uint8Array },
  replyTo?: string,
  unsubscribeUrl?: string
): Promise<{ ok: boolean; error?: string }> {
  const { apiKey, fromEmail } = getEmailCredentials();
  if (!apiKey) {
    console.log(`[email skipped — not configured] subject="${subject}"`);
    return { ok: false, error: "Email isn't configured yet — set RESEND_API_KEY in Vercel." };
  }

  // Staging (Preview) and development email NOBODY but the one test inbox, with a [STAGING] subject prefix. Only the live site
  // (Production) sends to the real recipient.
  const route = emailRouteFor(deploymentOf());
  if (route.action === "sink") {
    html = `<p style="background:#fff3cd;padding:8px;border-radius:6px;font-size:13px;">STAGING: this email was meant for <strong>${to.replace(/[<>&"]/g, "")}</strong> and was redirected to this test inbox.</p>${html}`;
    console.log(`[email redirected on staging] original recipient replaced by the test inbox; subject="${subject}"`);
    subject = `[STAGING] ${subject}`;
    to = route.to;
    replyTo = undefined;
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
