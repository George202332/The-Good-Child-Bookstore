import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { isIndexableDeployment } from "@/lib/seo/indexing";

/**
 * Crawler rules. On the live site: everything public is open; private areas (admin, author dashboard, account, library, cart,
 * checkout, API, sign-in and download routes) are closed. On staging (or any copy that is not the live site) EVERYTHING is closed,
 * and every page also carries a no-index signal, so staging can never appear in Google.
 */
export const PRIVATE_PATHS = ["/admin", "/account", "/library", "/api", "/checkout", "/cart", "/editor", "/investor", "/login", "/forgot-password", "/reset-password", "/verify-email", "/welcome", "/wishlist", "/unsubscribe"];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();
  if (!isIndexableDeployment()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
