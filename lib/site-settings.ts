export interface PaymentBadgeUrls {
  paypal?: string;
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
 * Both PayPal and Paystack issue separate credential pairs for their
 * test/sandbox and live environments — paymentMode picks which pair is
 * actually used at checkout, so switching from testing to going live is
 * one toggle, not re-entering keys.
 */
export interface ApiKeys {
  luluApiKey?: string;
  resendApiKey?: string;
  fromEmail?: string;
  paymentMode: "test" | "live";
  paypalSandboxClientId?: string;
  paypalSandboxClientSecret?: string;
  paypalLiveClientId?: string;
  paypalLiveClientSecret?: string;
  paystackTestSecretKey?: string;
  paystackTestPublicKey?: string;
  paystackLiveSecretKey?: string;
  paystackLivePublicKey?: string;
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
