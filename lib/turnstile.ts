/**
 * Cloudflare Turnstile — the CAPTCHA layer on the Reader/Author signup
 * forms (components/TurnstileWidget.tsx on the client, this file on
 * the server). Entirely env-gated, same pattern as GA4/GTM in
 * app/layout.tsx: with no TURNSTILE_SECRET_KEY set, verification is
 * skipped rather than failing every signup, so this ships safely
 * before George creates a Cloudflare Turnstile site and adds real
 * keys — see .env.example.
 */
export async function verifyTurnstileToken(token: string | null, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured yet — don't block signups over it

  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    // Cloudflare unreachable — fail open rather than blocking every
    // real signup over a third-party outage; the rate limit and
    // honeypot are still in effect either way.
    return true;
  }
}
