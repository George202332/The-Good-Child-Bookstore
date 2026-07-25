/** The real, public site URL — used across sitemaps, robots.txt,
 * JSON-LD, RSS feeds, and canonical tags. Prefers an explicitly-set
 * NEXT_PUBLIC_SITE_URL (e.g. once a custom domain is attached), falling
 * back to a stable placeholder domain for local/preview builds. */
export function getPublicSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://thegoodchildbookstore.com";
}
