export interface PaymentBadgeUrls {
  mastercard?: string;
  visa?: string;
  amex?: string;
  // Verve is a real card network Paystack checkout actually accepts
  // (see app/checkout/page.tsx's "Pay securely with Paystack cards"
  // row) — unrelated to the footer's trust-badge row below, and kept
  // here even though the footer itself no longer displays it.
  verve?: string;
  paypal?: string;
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
 * Lulu (print-on-demand) gets the same backend-manageable treatment.
 * Author/affiliate payouts are executed manually by an admin outside
 * this system (see actions/admin.ts and actions/payouts.ts), so there
 * are no payout-gateway credentials here any more.
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
}

export interface PublishingFormatsEnabled {
  ebook: boolean;
  print: boolean;
  audiobook: boolean;
}

/** The 6 fixed footer social media slots. Which platform each slot is
 * for isn't itself admin-editable (that wasn't asked for) — only the
 * icon image and the destination link for each one are. Leave a slot's
 * url blank and it's simply not rendered in the footer. */
export type SocialPlatform = "facebook" | "instagram" | "pinterest" | "youtube" | "twitter" | "tiktok";

export interface SocialLinkSettings {
  /** Where the icon links to. A blank/missing url hides that slot entirely. */
  url?: string;
  /** Admin-uploaded icon image for this slot; falls back to a built-in icon (see components/SocialIcon.tsx) when empty. */
  imageUrl?: string;
}

export type SocialLinks = Record<SocialPlatform, SocialLinkSettings>;

export interface SiteSettings {
  logoImageUrl?: string;
  faviconImageUrl?: string;
  footerTagline: string;
  footerCopyright: string;
  paymentBadges: PaymentBadgeUrls;
  /** The footer's 6 social media icon slots — icon image + destination
   * link, both editable from /admin/site-settings. */
  socialLinks: SocialLinks;
  /** Which formats authors can currently submit new titles in — Admin
   * controls this from Book Management. A format switched off here
   * disappears entirely from the "Submit a new title" page's tabs;
   * it does not affect books already submitted in that format. */
  publishingFormatsEnabled: PublishingFormatsEnabled;
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
  // All 6 slots default to a plain "#" placeholder link (same as the
  // original 4 hardcoded footer icons before this round) so the footer
  // always shows all 6 out of the box — an Admin sets each one's real
  // destination link (and optionally a logo image) in Site Settings.
  socialLinks: {
    facebook: { url: "#" },
    instagram: { url: "#" },
    pinterest: { url: "#" },
    youtube: { url: "#" },
    twitter: { url: "#" },
    tiktok: { url: "#" },
  },
  publishingFormatsEnabled: { ebook: true, print: false, audiobook: true },
  apiKeys: { paymentMode: "test" },
};
