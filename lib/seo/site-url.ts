/**
 * The real, public site URL — used across sitemaps, robots.txt,
 * JSON-LD, RSS feeds, and canonical tags.
 *
 * This is the same class of bug that broke the post-payment redirect
 * earlier: falling back to a placeholder domain that isn't actually the
 * live site. Fixed the same way — prefer an explicitly-set
 * NEXT_PUBLIC_SITE_URL (e.g. once a real custom domain is attached),
 * then fall back to Vercel's automatically-provided VERCEL_URL (needs
 * zero manual setup, always correct for whatever the current deployment
 * actually is), and only use a placeholder domain for local dev where
 * neither is set.
 */
export function getPublicSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // The real custom domain is the correct default for production —
  // referral links, promotion links, receipts, etc. should always
  // point at thegoodchildbookstore.com, not a generic Vercel URL.
  if (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production") {
    return "https://thegoodchildbookstore.com";
  }
  // Preview/branch deployments still get their own real URL, which is
  // useful for actually testing a preview rather than always linking
  // back to production.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://thegoodchildbookstore.com";
}
