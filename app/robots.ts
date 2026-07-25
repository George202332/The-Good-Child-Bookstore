import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

/**
 * Converted from the brief's SEO requirement to auto-generate
 * robots.txt. /account and /admin are excluded since they're private,
 * signed-in-only surfaces with no public content worth indexing.
 * Explicit per-crawler rules for Google/Bing (full access) and the
 * common AI crawlers (allowed, since a children's bookstore has nothing
 * to lose from AI-assisted discovery) — separated out rather than one
 * generic "*" rule, so any of them can be tightened individually later
 * without affecting the others.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();
  const disallow = ["/account", "/admin", "/api", "/checkout", "/cart"];

  return {
    rules: [
      { userAgent: "Googlebot", allow: "/", disallow },
      { userAgent: "Bingbot", allow: "/", disallow },
      { userAgent: "GPTBot", allow: "/", disallow },
      { userAgent: "ChatGPT-User", allow: "/", disallow },
      { userAgent: "CCBot", allow: "/", disallow },
      { userAgent: "anthropic-ai", allow: "/", disallow },
      { userAgent: "ClaudeBot", allow: "/", disallow },
      { userAgent: "*", allow: "/", disallow },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
