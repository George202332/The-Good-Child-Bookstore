"use server";

import { sendEmail } from "@/lib/email";

export interface ContactFormInput {
  name: string;
  email: string;
  topic: string;
  message: string;
}

const SUPPORT_INBOX = process.env.SUPPORT_INBOX_EMAIL || "support@thegoodchildbookstore.com";

/**
 * Contact form submission — delivers to the support inbox via the
 * centralized send-only email service (Resend), with Reply-To set to
 * the visitor so support can just hit reply. Replaces the earlier
 * Gmail OAuth-based delivery, which required inbox-read-adjacent
 * infrastructure this integration no longer uses at all.
 */
export async function submitContactForm(input: ContactFormInput): Promise<{ ok: boolean; error?: string }> {
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();

  if (!name) return { ok: false, error: "Please enter your name." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (!message) return { ok: false, error: "Please enter a message." };

  const bodyHtml = `
    <div style="font-family: Georgia, serif;">
      <p><strong>New contact form submission</strong></p>
      <p><strong>Name:</strong> ${name}<br/>
      <strong>Email:</strong> ${email}<br/>
      <strong>Topic:</strong> ${input.topic || "Not specified"}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${message}</p>
    </div>
  `;

  const result = await sendEmail(
    SUPPORT_INBOX,
    `Contact form: ${input.topic || "New message"} — from ${name}`,
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
