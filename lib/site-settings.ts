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
 * Keys are NO LONGER stored here. Paystack, PayPal, Lulu and email keys live only in Vercel environment variables
 * (see lib/payment-env.ts). The only thing left in this group is a plain, non-secret choice: which shipping methods
 * customers may pick for printed copies. The name "apiKeys" is kept so earlier choices carry over unchanged.
 */
export interface ApiKeys {
  /** Shipping methods customers may pick for printed copies (Lulu shipping_level values). Unset/empty = all methods offered. */
  luluShippingLevels?: string[];
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
  /** Whether PayPal may be chosen as a PAYOUT method (not checkout). Default OFF. */
  paypalPayoutsEnabled: boolean;
  /** Whether M-Pesa may be chosen as a PAYOUT method (not checkout). Default OFF. */
  mpesaPayoutsEnabled: boolean;
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
  apiKeys: {},
  paypalPayoutsEnabled: false,
  mpesaPayoutsEnabled: false,
};
