export interface PaymentBadgeUrls {
  mpesa?: string;
  mastercard?: string;
  visa?: string;
  amex?: string;
  verve?: string;
}

/**
 * API credentials manageable from the backend, per explicit request —
 * these were previously only settable via Vercel's environment variable
 * panel, which George can't easily edit himself. Values here take
 * priority over the equivalent environment variables (see
 * lib/api-keys.ts) — set here, or leave blank to keep using whatever's
 * configured in Vercel.
 *
 * Rebuilt per explicit instruction: PayPal removed entirely (checkout
 * only takes cards via Paystack now). Paystack collapsed from 4 fields
 * (separate test/live secret+public pairs) down to just one secret key
 * and one public key — paymentMode is now purely a label for which
 * mode the currently-entered pair actually is (Paystack test and live
 * keys are already distinguishable by their own sk_test_/sk_live_ and
 * pk_test_/pk_live_ prefixes), not a switch between two stored sets.
 * Wise (real money transfers for author/affiliate payouts) and Lulu
 * (print-on-demand) get the same backend-manageable treatment.
 */
export interface ApiKeys {
  luluClientKey?: string;
  luluClientSecret?: string;
  resendApiKey?: string;
  fromEmail?: string;
  /** A label for which kind of Paystack key is currently entered below —
   * not a switch between two stored sets, since there's only one pair now. */
  paymentMode: "test" | "live";
  paystackSecretKey?: string;
  paystackPublicKey?: string;
  wiseApiToken?: string;
  wiseProfileId?: string;
}

export interface SiteSettings {
  logoImageUrl?: string;
  faviconImageUrl?: string;
  footerTagline: string;
  footerCopyright: string;
  paymentBadges: PaymentBadgeUrls;
  apiKeys: ApiKeys;
}

/**
 * Defaults matching what's currently hardcoded in Logo.tsx/Footer.tsx —
 * used until an Admin overrides them via /admin/site-settings. Payment
 * badges default to real (original, non-trademarked) card-style icons
 * (see components/PaymentBadgeIcon.tsx) rather than plain text; setting
 * a URL for any of them switches that one badge to an uploaded image
 * instead (e.g. an official logo, if you have the rights to use it).
 */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  logoImageUrl: undefined,
  faviconImageUrl: undefined,
  footerTagline:
    "Storybooks chosen for the way they read aloud, the questions they raise at bedtime, and the shelf-worthy art on every cover. Trusted by parents, teachers, and school librarians.",
  footerCopyright: "© 2026 The Good Child Bookstore. Every cover here is invented for storytime.",
  paymentBadges: {},
  apiKeys: { paymentMode: "test" },
};
