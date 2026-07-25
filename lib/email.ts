import { prisma } from "@/lib/prisma";

/**
 * Real transactional email sending via Resend's HTTP API (a plain
 * fetch() call — no SDK dependency needed, since the API is just a
 * single POST request). Order receipts (actions/order-emails.ts) are
 * the first real use — previously there was no email-sending
 * infrastructure at all ("Confirmation email would be sent here once
 * an email service is wired up").
 *
 * Credentials are backend-editable from Site Settings (same pattern as
 * Lulu/PayPal/Paystack), falling back to RESEND_API_KEY/FROM_EMAIL env
 * vars. If nothing's configured, sends are skipped with a console log
 * rather than throwing — a missing email setup should never break order
 * confirmation itself.
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

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const { apiKey, fromEmail } = await getEmailCredentials();
  if (!apiKey) {
    console.log(`[email skipped — not configured] to=${to} subject="${subject}"`);
    return { ok: false, error: "Email isn't configured yet." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Email send failed: ${res.status} ${body}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed." };
  }
}
