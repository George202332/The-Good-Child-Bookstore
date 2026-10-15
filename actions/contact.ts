"use server";

import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/geo";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { CONTACT_LIMITS, checkContactSubmission, escapeHtml, singleLine } from "@/lib/contact-guard";

export interface ContactFormInput {
  name: string;
  email: string;
  topic: string;
  message: string;
  /** Hidden trap field — real visitors never fill it. */
  honeypot?: string;
  /** When the form was shown (ms since epoch), set by the page. */
  startedAt?: number;
  /** Cloudflare Turnstile token; null when Turnstile isn't configured. */
  turnstileToken?: string | null;
}

const SUPPORT_INBOX = process.env.SUPPORT_INBOX_EMAIL || "support@thegoodchildbookstore.com";

/**
 * Contact form submission — delivers to the support inbox via the
 * centralized send-only email service (Resend), with Reply-To set to
 * the visitor so support can just hit reply.
 *
 * Bot protection (this form is public, so it is the easiest place for a
 * script to flood the inbox). In order:
 *  1. hidden trap field and "filled in too fast" check — bots get a
 *     pretend "sent" so they learn nothing;
 *  2. length, shape and link-count limits;
 *  3. at most 5 submissions per connection per hour;
 *  4. Cloudflare Turnstile (when its keys are set — see .env.example);
 *  5. everything the visitor typed is HTML-escaped and line breaks are
 *     stripped from the email subject, so nothing can be injected into
 *     the message support receives.
 */
export async function submitContactForm(input: ContactFormInput): Promise<{ ok: boolean; error?: string }> {
  const checked = checkContactSubmission(input);
  if (!checked.ok) {
    if (checked.silent) return { ok: true };
    return { ok: false, error: checked.error };
  }

  const ip = (await getRequestIp()) ?? "unknown";
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await prisma.contactAttempt.count({ where: { ip, createdAt: { gte: oneHourAgo } } });
    if (recent >= CONTACT_LIMITS.perIpPerHour) {
      return { ok: false, error: "You have sent several messages recently — please wait a little while before sending another." };
    }
    await prisma.contactAttempt.create({ data: { ip } });
  } catch (e) {
    // If the rate-limit table is unavailable the other checks still apply;
    // a database hiccup must not stop a real customer reaching support.
    console.error("Contact rate limit check failed", e);
  }

  const turnstileOk = await verifyTurnstileToken(input.turnstileToken ?? null, ip === "unknown" ? null : ip);
  if (!turnstileOk) {
    return { ok: false, error: "Please complete the verification challenge and try again." };
  }

  const name = singleLine(input.name);
  const email = input.email.trim();
  const topic = singleLine(input.topic) || "Not specified";
  const message = input.message.trim();

  const bodyHtml = `
    <div style="font-family: Georgia, serif;">
      <p><strong>New contact form submission</strong></p>
      <p><strong>Name:</strong> ${escapeHtml(name)}<br/>
      <strong>Email:</strong> ${escapeHtml(email)}<br/>
      <strong>Topic:</strong> ${escapeHtml(topic)}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;

  const result = await sendEmail(
    SUPPORT_INBOX,
    `Contact form: ${topic === "Not specified" ? "New message" : topic} — from ${name}`.slice(0, 200),
    bodyHtml,
    undefined,
    email
  );

  if (!result.ok) {
    // The visitor still gets a clear answer rather than a false
    // "we got it" — a delivery failure is worth knowing immediately
    // rather than silently losing the submission.
    return { ok: false, error: "We couldn't deliver your message right now — please try emailing support@thegoodchildbookstore.com directly." };
  }

  return { ok: true };
}
