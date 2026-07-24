import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { SiteChrome } from "@/components/SiteChrome";
import { getSiteSettings } from "@/actions/site-settings";
import { Providers } from "@/components/Providers";

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
    robots: "index, follow",
    alternates: { canonical: "https://thegoodchildbookstore.com/" },
    openGraph: {
      type: "website",
      siteName: "The Good Child Bookstore",
      title: "The Good Child Bookstore | Storybooks Chosen for Bedtime and Read-Aloud",
      description:
        "A curated children's bookshop: picture books, bedtime stories, and middle grade reads chosen for how they read aloud and the art on every cover.",
      url: "https://thegoodchildbookstore.com/",
      images: ["https://thegoodchildbookstore.com/og-cover.png"],
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: "The Good Child Bookstore",
      description:
        "Storybooks chosen for the way they read aloud, the questions they raise at bedtime, and the shelf-worthy art on every cover.",
      images: ["https://thegoodchildbookstore.com/og-cover.png"],
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

export const viewport: Viewport = {
  themeColor: "#3F3350",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "BookStore",
  name: "The Good Child Bookstore",
  description:
    "A curated children's bookshop for picture books, bedtime stories, and middle grade reads, with a monthly book subscription box.",
  url: "https://thegoodchildbookstore.com/",
  sameAs: [],
  makesOffer: {
    "@type": "Offer",
    itemOffered: { "@type": "Service", name: "Monthly children's book subscription box" },
  },
};

/**
 * Forces every page to render fresh on each request, rather than being
 * frozen as static HTML at build time. Without this, most storefront
 * pages (shop, about, contact, etc.) were being statically generated —
 * meaning the logo/footer/homepage content fetched here in the root
 * layout only ever reflected whatever was true at the last deploy, not
 * what's actually saved in Site Settings right now. This was the real
 * cause of "changes at the backend don't take effect on the frontend."
 */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {/* Google Analytics 4 — only loads when NEXT_PUBLIC_GA_MEASUREMENT_ID
            is set in .env, per the brief's "Google Analytics 4" requirement. */}
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');`}
            </Script>
          </>
        )}
        {/* Google Tag Manager — only loads when NEXT_PUBLIC_GTM_ID is set. */}
        {gtmId && (
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
              j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');`}
          </Script>
        )}
      </head>
      <body>
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        )}
        <Providers>
          <SiteChrome settings={settings}>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
