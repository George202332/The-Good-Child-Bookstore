/**
 * The real, public site URL — used across sitemaps, robots.txt,
 * JSON-LD, RSS feeds, canonical tags, and payment gateway callback
 * URLs.
 *
 * Always returns the real domain unless NEXT_PUBLIC_SITE_URL is
 * explicitly set to something else. No VERCEL_URL fallback: that
 * fallback was the actual, repeated cause of buyers being redirected
 * to a Vercel-generated address after paying instead of the real
 * site — it was meant only for preview/branch deployments, but ended
 * up firing in situations where VERCEL_ENV wasn't exactly
 * "production" for reasons that were hard to pin down and kept
 * recurring. Removing it entirely is the reliable fix: this always
 * resolves to the real domain in every environment except local dev
 * (where NODE_ENV !== "production"), with nothing environment-
 * variable-dependent left to go wrong.
 */
export function getPublicSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  return "https://thegoodchildbookstore.com";
}
