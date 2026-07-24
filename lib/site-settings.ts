export interface PaymentBadgeUrls {
  paypal?: string;
  mastercard?: string;
  visa?: string;
  amex?: string;
  verve?: string;
}

export interface SiteSettings {
  logoImageUrl?: string;
  footerTagline: string;
  footerCopyright: string;
  paymentBadges: PaymentBadgeUrls;
}

/**
 * Defaults matching what's currently hardcoded in Logo.tsx/Footer.tsx —
 * used until an Admin overrides them via /admin/site-settings. Payment
 * badges default to the plain-text labels the footer has always shown;
 * setting a URL for any of them switches that one badge to a real image.
 */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  logoImageUrl: undefined,
  footerTagline:
    "Storybooks chosen for the way they read aloud, the questions they raise at bedtime, and the shelf-worthy art on every cover. Trusted by parents, teachers, and school librarians.",
  footerCopyright: "© 2026 The Good Child Bookstore. Every cover here is invented for storytime.",
  paymentBadges: {},
};
