import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thegoodchildbookstore.com";

/** Converted from the brief's SEO requirement to auto-generate robots.txt.
 * /account and /admin are excluded since they're private, signed-in-only
 * surfaces with no public content worth indexing. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/api", "/checkout", "/cart"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
