/**
 * A small, deliberately conservative denylist of well-known throwaway/
 * temporary-inbox email domains — one lever in the signup bot-fighting
 * combo (see actions/auth.ts registerUser), alongside the honeypot
 * field, per-IP rate limit, and optional Turnstile challenge. This list
 * only catches services that exist purely to receive a one-off
 * verification email and self-destruct, so it never risks blocking a
 * real reader or author's actual inbox provider.
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "discard.email",
  "throwawaymail.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "mailnesia.com",
  "mintemail.com",
  "moakt.com",
  "spamgourmet.com",
  "mytemp.email",
  "emailondeck.com",
  "burnermail.io",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  return !!domain && DISPOSABLE_EMAIL_DOMAINS.has(domain);
}
