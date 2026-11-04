import { resolveSiteBase } from "@/lib/site-address";

/**
 * The public site URL for THIS copy of the site: used in sitemaps, robots.txt, JSON-LD, RSS feeds, canonical tags and links.
 * Worked out from the environment (see lib/site-address.ts): the live site uses the real domain, staging uses its own address,
 * a developer's computer uses localhost. Never the live domain on staging. Payments use getPaymentReturnBase() in
 * actions/payment-init.ts, which also looks at the address the customer is actually on.
 */
export function getPublicSiteUrl(): string {
  return resolveSiteBase().url || "https://thegoodchildbookstore.com";
}
