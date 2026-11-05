import type { Metadata, Viewport } from "next";
import { AnalyticsConsent } from "@/components/AnalyticsConsent";
import { analyticsEnabledFor } from "@/lib/analytics/policy";
import "./globals.css";
import { SiteChrome } from "@/components/SiteChrome";
import { getSiteSettings } from "@/actions/site-settings";
import { Providers } from "@/components/Providers";
import { StagingBanner } from "@/components/StagingBanner";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { isIndexableDeployment } from "@/lib/seo/indexing";

const DEFAULT_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'%3E%3Ccircle cx='30' cy='30' r='28' fill='%23F7D8E2'/%3E%3Ccircle cx='22' cy='27' r='5' fill='%233F3350'/%3E%3Ccircle cx='38' cy='27' r='5' fill='%233F3350'/%3E%3Ccircle cx='22' cy='27' r='2' fill='%23fff'/%3E%3Ccircle cx='38' cy='27' r='2' fill='%23fff'/%3E%3Cpath d='M30 32 L26 40 L34 40 Z' fill='%23F4B942'/%3E%3C/svg%3E";

// Metadata ported from the original frontend's <head> block
// (the-good-child-bookstore_54_1.html:1-27). Converted from a static
// export to generateMetadata() so the favicon can reflect an
// admin-uploaded one from Site Settings.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    title: "The Good Child Bookstore | Storybooks Chosen for Bedtime, Read-Aloud, and Every Shelf",
    description:
      "The Good Child Bookstore is a curated children's bookshop for picture books, bedtime stories, and middle grade reads (chosen for how they read aloud, the questions they raise at bedtime, and the art on every cover). Shop by age and genre, subscribe to a monthly book box, or explore our authors' blog.",
    keywords: [
      "children's books",
      "picture books",
      "bedtime stories",
      "middle grade books",
      "kids book subscription",
      "read-aloud books",
      "book box for kids",
      "children's bookstore",
      "independent bookstore",
    ],
    authors: [{ name: "The Good Child Bookstore" }],
    // Only the live site may be indexed; staging and every other copy says "do not index" on every page.
    robots: isIndexableDeployment() ? { index: true, follow: true } : { index: false, follow: false },
    // No canonical address here on purpose: a canonical set in the root layout is inherited by every page that does not set its
    // own, which would tell Google those pages are copies of the home page. Each page sets its own (see lib/seo/page-meta.ts).
    metadataBase: new URL(getPublicSiteUrl()),
    alternates: { types: { "application/rss+xml": "/feed.xml" } },
    openGraph: {
      type: "website",
      siteName: "The Good Child Bookstore",
      title: "The Good Child Bookstore | Storybooks Chosen for Bedtime and Read-Aloud",
      description:
        "A curated children's bookshop: picture books, bedtime stories, and middle grade reads chosen for how they read aloud and the art on every cover.",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: "The Good Child Bookstore",
      description:
        "Storybooks chosen for the way they read aloud, the questions they raise at bedtime, and the shelf-worthy art on every cover.",
    },
    icons: {
      icon: settings.faviconImageUrl || DEFAULT_FAVICON,
    },
    // Google Search Console verification: set GOOGLE_SITE_VERIFICATION in
    // .env (see .env.example) — omitted entirely when unset, rather than
    // rendering an empty/placeholder verification tag.
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
      other: process.env.BING_SITE_VERIFICATION
        ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
        : undefined,
    },
  };
}

// Defining a custom `viewport` export replaces Next.js's own default
// entirely (it doesn't merge with it) — with only `themeColor` set here,
// the page was shipping with NO `width`/`initialScale`, i.e. no real
// `<meta name="viewport" content="width=device-width, initial-scale=1">`
// at all. That's exactly the condition that brings back the browser's
// legacy ~300ms double-tap-to-zoom delay on every tap, which modern
// mobile browsers only suppress automatically once they can see a page
// has explicitly opted out of pinch-zoom-via-double-tap via a proper
// viewport meta tag — this is almost certainly the real cause of the
// site-wide tap lag on mobile (see also the global `touch-action:
// manipulation` rule added in app/site.css for the same issue).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2E2442",
};

/**
 * This used to force EVERY page in the entire site to render fresh on
 * each request (export const dynamic = "force-dynamic" right here in
 * the root layout, which every single route sits under). That was a
 * blunt fix for a real problem — Site Settings changes (logo, footer)
 * not showing up without a redeploy — but it had a much bigger side
 * effect than intended: it wasn't just Site Settings holding pages
 * back, it was the per-user dark-mode lookup below, which read the
 * signed-in session (a cookie) and therefore forced Next.js to treat
 * the *entire* render tree — homepage, Authorship, Affiliate, Blog,
 * every marketing page, none of which change per request — as fully
 * dynamic too. That meant a full server round trip (session lookup +
 * two separate database reads) had to finish before the very first
 * byte of HTML went out on every single page view, which is what made
 * first paint feel slow and, on a slow connection, briefly show an
 * unstyled/incomplete page before the real layout snapped in.
 *
 * Fixed properly instead of papered over: getSiteSettings() below has
 * no per-user dependency (no cookies, no session) so it was never the
 * actual problem and can stay here safely. Dark mode now applies from
 * a plain, non-httpOnly cookie read by a tiny inline script in <head>,
 * synchronously, before the page paints — the standard way to avoid a
 * "flash of wrong theme" without forcing the whole app to be dynamic
 * just to know one person's light/dark preference (see
 * DARK_MODE_COOKIE in actions/settings.ts, set whenever the toggle on
 * /account/settings is changed). The rest of the site is free to be
 * statically generated/cached again.
 */

const DARK_MODE_INIT_SCRIPT = `
try {
  // Dark mode no longer exists. Clear any leftover choice so nobody is stuck in it.
  document.documentElement.classList.remove("dark-mode");
  document.cookie = "gcb-dark-mode=; path=/; max-age=0";
} catch (e) {}
`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();
  // Analytics exists only on the live site, decided here from VERCEL_ENV: the two ids may stay set on staging and nothing loads.
  const analyticsOn = analyticsEnabledFor();
  const gaId = analyticsOn ? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null : null;
  const gtmId = analyticsOn ? process.env.NEXT_PUBLIC_GTM_ID || null : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before paint, synchronously — see DARK_MODE_INIT_SCRIPT
            above for why this is a plain script reading a cookie rather
            than a server-computed class on <html>. */}
        <script dangerouslySetInnerHTML={{ __html: DARK_MODE_INIT_SCRIPT }} />
        {/* Google defaults to "denied" until the visitor accepts (see components/AnalyticsConsent.tsx, the only place
            Google Analytics / Tag Manager are loaded). Only emitted on the live site. */}
        {analyticsOn && (gaId || gtmId) && (
          <script dangerouslySetInnerHTML={{ __html: "window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments);};gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});" }} />
        )}
      </head>
      <body>
        <StagingBanner />
        <AnalyticsConsent enabled={analyticsOn} gaId={gaId} gtmId={gtmId} />
        <Providers>
          <SiteChrome settings={settings}>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
