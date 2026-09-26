/**
 * Minimal SMS sender for phone-based 2FA codes — Twilio's plain REST
 * API via fetch, not the twilio npm SDK, so this doesn't add a new
 * dependency to the project just to send one text message. There is
 * no existing SMS infrastructure anywhere else in this app (grepped
 * for it before writing this — nothing), so Twilio was chosen as the
 * standard, well-documented choice rather than inventing something
 * unusual; swapping providers later only means rewriting this one
 * file.
 *
 * Required environment variables (see .env.example):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER   — a Twilio phone number in E.164 format, e.g. +15551234567
 *
 * If these aren't set, sendSms() returns a clear, non-throwing error
 * rather than crashing — the same "decoupled from the rest of the
 * app" pattern lib/email.ts already uses when Resend isn't configured.
 */
export async function sendSms(to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { ok: false, error: "SMS sending isn't configured yet — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER." };
  }
  if (!to.trim()) return { ok: false, error: "No phone number on file." };

  try {
    const body = new URLSearchParams({ To: to, From: fromNumber, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[sms] Twilio send failed", res.status, errText);
      return { ok: false, error: `SMS provider returned an error (status ${res.status}).` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[sms] Twilio send threw", err);
    return { ok: false, error: "Could not reach the SMS provider." };
  }
}
