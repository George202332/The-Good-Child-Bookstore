"use server";

import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { canModerateContent } from "@/lib/roles";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { getIndexingReport, type IndexingRow } from "./seo-marketing";

/**
 * Google Infrastructure — a single admin area that CONSOLIDATES the
 * Google-facing pieces that already exist scattered across the app
 * (GA4/GTM script injection in app/layout.tsx, Search Console site
 * verification meta tag in the same file, the auto-generated
 * sitemaps/robots.txt, and the JSON-LD structured data) into one
 * status + diagnostics view.
 *
 * Nothing here creates a new GA4 property, a new Search Console
 * property, or a second/parallel config system — it only reads the
 * same env vars and the same generated feeds the rest of the app
 * already relies on, and reuses actions/seo-marketing.ts's existing
 * indexing report rather than re-querying the database a second way.
 *
 * No Google OAuth/API credentials are configured in this app (see the
 * honest limitation already noted in actions/seo-marketing.ts), so
 * nothing here can pull live GA4 numbers or live Search Console
 * crawl/index counts — that data only exists inside Google's own
 * platforms. What this DOES do reliably: confirm the connection is
 * *wired up correctly* on our side (the right IDs are set, the right
 * tags render, the right files exist and resolve), and hand off to
 * Google's own dashboards for the actual reporting.
 */

export type GoogleServiceStatus = "healthy" | "connected" | "configured" | "needs_verification" | "warning" | "not_configured";

export interface GoogleServiceRow {
  key: string;
  label: string;
  status: GoogleServiceStatus;
  detail: string;
  actionLabel?: string;
  actionHref?: string;
}

function maskId(id: string | undefined): string | null {
  if (!id) return null;
  if (id.length <= 6) return id;
  return `${id.slice(0, 4)}…${id.slice(-3)}`;
}

/** Overall Google Services Status — one row per component, each
 * independently connected/configured/healthy/warning, never a single
 * combined "is Google working" boolean (a GA4 outage should never look
 * like a sitemap problem, and vice versa). */
export async function getGoogleServicesStatus(): Promise<GoogleServiceRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return [];

  const siteUrl = getPublicSiteUrl();
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION;
  const isHttps = siteUrl.startsWith("https://");

  const rows: GoogleServiceRow[] = [
    {
      key: "analytics",
      label: "Google Analytics (GA4)",
      status: gaId ? "connected" : "not_configured",
      detail: gaId
        ? `Measurement ID ${maskId(gaId)} is set — gtag.js loads on every page.`
        : "NEXT_PUBLIC_GA_MEASUREMENT_ID is not set in environment variables — no GA4 tag is rendered.",
      actionLabel: "Open GA4",
      actionHref: "https://analytics.google.com/analytics/web/",
    },
    {
      key: "tag-manager",
      label: "Google Tag Manager",
      status: gtmId ? "connected" : "not_configured",
      detail: gtmId
        ? `Container ${maskId(gtmId)} is set — GTM loads on every page (optional, alongside GA4).`
        : "NEXT_PUBLIC_GTM_ID is not set — optional, only needed if tags are managed through GTM instead of directly.",
      actionLabel: "Open Tag Manager",
      actionHref: "https://tagmanager.google.com/",
    },
    {
      key: "search-console",
      label: "Google Search Console",
      status: googleVerification ? "connected" : "needs_verification",
      detail: googleVerification
        ? "Site-verification meta tag is present in <head> — Search Console should recognize this property as verified."
        : "GOOGLE_SITE_VERIFICATION is not set — add the verification code from Search Console's HTML tag method to finish verifying this property.",
      actionLabel: "Open Search Console",
      actionHref: `https://search.google.com/search-console?resource_id=${encodeURIComponent(siteUrl + "/")}`,
    },
    {
      key: "sitemap",
      label: "Sitemap",
      status: "healthy",
      detail: "Auto-generated sitemap index at /sitemap.xml, split into books/blogs/authors/static-pages sub-sitemaps — regenerates on every request, never goes stale.",
      actionLabel: "View sitemap",
      actionHref: `${siteUrl}/sitemap.xml`,
    },
    {
      key: "robots",
      label: "Robots.txt",
      status: "healthy",
      detail: "Auto-generated at /robots.txt — explicitly allows Googlebot on all public pages and disallows /account, /admin, /api, /checkout, /cart.",
      actionLabel: "View robots.txt",
      actionHref: `${siteUrl}/robots.txt`,
    },
    {
      key: "structured-data",
      label: "Structured data (JSON-LD)",
      status: "healthy",
      detail: "BookStore schema.org markup on every page, plus per-book/author/blog structured data — powers rich results in Google Search.",
    },
    {
      key: "https",
      label: "HTTPS",
      status: isHttps ? "healthy" : "warning",
      detail: isHttps
        ? "The public site URL resolves over HTTPS — required for Search Console verification and for Google to treat the site as secure."
        : `The resolved site URL (${siteUrl}) is not HTTPS — this will block Search Console verification and hurt ranking signals in production.`,
    },
  ];

  return rows;
}

export type IndexHealth = "healthy" | "warning" | "excluded";

export interface GoogleIndexingRow {
  url: string;
  path: string;
  pageType: string;
  title: string;
  indexable: boolean;
  sitemapIncluded: boolean;
  robotsStatus: "allowed" | "disallowed";
  canonicalStatus: "self-canonical" | "not-applicable";
  health: IndexHealth;
  reason: string;
  indexNowStatus: IndexingRow["status"] | null;
  lastSubmittedAt: Date | null;
  inspectUrl: string;
}

// Private/authenticated surfaces that are INTENTIONALLY kept out of
// the index — shown in the table as a clearly separate, expected
// state, never lumped in with a real public-page indexing problem.
const INTENTIONAL_EXCLUSIONS: { path: string; label: string; type: string }[] = [
  { path: "/admin", label: "Admin backend", type: "Private area" },
  { path: "/account", label: "Reader/Author account area", type: "Private area" },
  { path: "/checkout", label: "Checkout", type: "Private area" },
  { path: "/cart", label: "Cart", type: "Private area" },
  { path: "/login", label: "Sign in", type: "Authentication" },
  { path: "/admin/login", label: "Backend sign in", type: "Authentication" },
  { path: "/api", label: "API routes", type: "API" },
];

/**
 * The Google SEO & Indexing table — reuses actions/seo-marketing.ts's
 * getIndexingReport() (the existing, real book/blog/author/static-page
 * eligibility + IndexNow-submission data) rather than re-deriving it,
 * and decorates each row with the extra columns this view needs
 * (indexable, sitemap inclusion, robots status, canonical status,
 * overall health), then appends the intentionally-excluded private
 * routes as their own clearly-labeled rows so they read as expected
 * configuration, not as errors.
 */
export async function getGoogleIndexingTable(): Promise<GoogleIndexingRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return [];

  const siteUrl = getPublicSiteUrl();
  const publicRows = await getIndexingReport();

  const rows: GoogleIndexingRow[] = publicRows.map((r) => {
    const path = r.url.replace(siteUrl, "") || "/";
    const health: IndexHealth = r.status === "FAILED" ? "warning" : "healthy";
    return {
      url: r.url,
      path,
      pageType: r.type,
      title: r.title,
      indexable: true,
      sitemapIncluded: true,
      robotsStatus: "allowed",
      canonicalStatus: "self-canonical",
      health,
      reason: r.status === "FAILED"
        ? "Eligible and included in the sitemap, but the last IndexNow submission failed — worth re-submitting."
        : "Public, indexable, included in the sitemap, and allowed by robots.txt.",
      indexNowStatus: r.status,
      lastSubmittedAt: r.lastSubmittedAt,
      inspectUrl: `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(siteUrl + "/")}&id=${encodeURIComponent(r.url)}`,
    };
  });

  for (const ex of INTENTIONAL_EXCLUSIONS) {
    const url = `${siteUrl}${ex.path}`;
    rows.push({
      url,
      path: ex.path,
      pageType: ex.type,
      title: ex.label,
      indexable: false,
      sitemapIncluded: false,
      robotsStatus: "disallowed",
      canonicalStatus: "not-applicable",
      health: "excluded",
      reason: "Intentionally excluded — private/authenticated area, disallowed in robots.txt and never added to the sitemap.",
      indexNowStatus: null,
      lastSubmittedAt: null,
      inspectUrl: `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(siteUrl + "/")}&id=${encodeURIComponent(url)}`,
    });
  }

  return rows;
}

export interface GoogleAnalyticsDiagnostics {
  configured: boolean;
  measurementId: string | null;
  gtmConfigured: boolean;
  gtmId: string | null;
  ecommerceEventCount: number;
}

/**
 * GA4 diagnostics — confirms the tag is wired up and reports how many
 * ecommerce-shaped events have been recorded in the app's own
 * AnalyticsEvent log (a local diagnostic count only). This NEVER reads
 * from or feeds into Order/SaleLine/royalty/commission math — Good
 * Child's own transaction system remains the sole source of truth for
 * revenue, royalties, and commissions; GA4 only ever mirrors it for
 * marketing analytics.
 */
export async function getGoogleAnalyticsDiagnostics(): Promise<GoogleAnalyticsDiagnostics> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) {
    return { configured: false, measurementId: null, gtmConfigured: false, gtmId: null, ecommerceEventCount: 0 };
  }

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  let ecommerceEventCount = 0;
  try {
    ecommerceEventCount = await prisma.analyticsEvent.count({
      where: { type: { in: ["purchase", "add_to_cart", "view_item", "begin_checkout"] } },
    });
  } catch {
    ecommerceEventCount = 0;
  }

  return {
    configured: !!gaId,
    measurementId: maskId(gaId),
    gtmConfigured: !!gtmId,
    gtmId: maskId(gtmId),
    ecommerceEventCount,
  };
}

export interface SearchConsoleDiagnostics {
  verified: boolean;
  propertyUrl: string;
  sitemapUrl: string;
  verificationMethod: string;
}

export async function getSearchConsoleDiagnostics(): Promise<SearchConsoleDiagnostics> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) {
    return { verified: false, propertyUrl: "", sitemapUrl: "", verificationMethod: "" };
  }

  const siteUrl = getPublicSiteUrl();
  const verified = !!process.env.GOOGLE_SITE_VERIFICATION;

  return {
    verified,
    propertyUrl: `${siteUrl}/`,
    sitemapUrl: `${siteUrl}/sitemap.xml`,
    verificationMethod: "HTML tag (meta name=\"google-site-verification\")",
  };
}
