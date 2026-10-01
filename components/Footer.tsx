import Link from "next/link";
import { Logo } from "./Logo";
import { PaymentBadgeIcon } from "./PaymentBadgeIcon";
import { SocialIcon, SOCIAL_PLATFORM_LABELS, type SocialPlatform } from "./SocialIcon";
import { DEFAULT_SITE_SETTINGS, type PaymentBadgeUrls, type SocialLinks } from "@/lib/site-settings";

const SOCIAL_PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "pinterest", "youtube", "twitter", "tiktok"];

/** Renders the footer's 6 social media slots — expanded from the
 * original 4 hardcoded, non-editable icons. Each slot's destination link
 * and icon image are now set from /admin/site-settings (see
 * SiteSettingsForm.tsx); a slot with no link set at all is skipped so an
 * unconfigured slot doesn't show a dead "#" link once an Admin starts
 * filling the others in. */
function SocialLinksRow({ links }: { links: SocialLinks }) {
  return (
    <div className="footer-social">
      {SOCIAL_PLATFORMS.map((platform) => {
        const link = links[platform];
        if (!link?.url) return null;
        const label = SOCIAL_PLATFORM_LABELS[platform];
        return (
          <a key={platform} href={link.url} aria-label={label} target={link.url === "#" ? undefined : "_blank"} rel={link.url === "#" ? undefined : "noopener noreferrer"}>
            {link.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded social icon, not a static asset
              <img src={link.imageUrl} alt={label} className="footer-social-img" />
            ) : (
              <SocialIcon platform={platform} />
            )}
          </a>
        );
      })}
    </div>
  );
}

// M-Pesa removed entirely per explicit request (this is the footer's
// visual trust-badge row only — the real M-Pesa payment integration
// elsewhere, e.g. checkout/Paystack, is untouched). The four remaining
// badges are sized 40% larger than before (was 22px tall) and the row
// itself got a cleaner card treatment — see .footer-payment-badges in
// app/site.css.
const PAYMENT_BADGE_LABELS: { key: keyof PaymentBadgeUrls; label: string }[] = [
  { key: "mastercard", label: "Mastercard" },
  { key: "visa", label: "Visa" },
  { key: "amex", label: "American Express" },
  { key: "paypal", label: "PayPal" },
];

/** Renders each payment badge as an admin-uploaded image if one is set
 * (/admin/site-settings), otherwise a real card-style icon (see
 * PaymentBadgeIcon.tsx) — no more plain text placeholders.
 *
 * Each badge sits in a fixed-size ".payment-badge-slot" card (widened
 * ~30% per explicit request) rather than being sized by its own content,
 * so a tall logo and a wide logo both land in the same footprint —
 * `object-fit: contain` inside the slot (see app/site.css) scales each
 * uploaded image down or up to fit without stretching its proportions
 * or cropping any of it, the same way the built-in SVG icons already
 * scale via their viewBox. */
function PaymentBadges({ badges }: { badges: PaymentBadgeUrls }) {
  return (
    <div className="footer-payment-badges">
      {PAYMENT_BADGE_LABELS.map(({ key, label }) => (
        <div key={key} className="payment-badge-slot">
          {badges[key] ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded badge image, not a static asset
            <img src={badges[key]} alt={label} className="payment-badge-img" />
          ) : (
            <PaymentBadgeIcon type={key} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Converted from footerHTML(minimal) (the-good-child-bookstore_54_1.html:3265).
 * Tagline, copyright, and payment badge images are all admin-editable now
 * (see /admin/site-settings, actions/site-settings.ts) — falls back to
 * the original hardcoded text when nothing's been overridden yet.
 */
export function Footer({
  minimal = false,
  logoImageUrl,
  footerTagline = DEFAULT_SITE_SETTINGS.footerTagline,
  footerCopyright = DEFAULT_SITE_SETTINGS.footerCopyright,
  paymentBadges = DEFAULT_SITE_SETTINGS.paymentBadges,
  socialLinks = DEFAULT_SITE_SETTINGS.socialLinks,
}: {
  minimal?: boolean;
  logoImageUrl?: string;
  footerTagline?: string;
  footerCopyright?: string;
  paymentBadges?: PaymentBadgeUrls;
  socialLinks?: SocialLinks;
}) {
  if (minimal) {
    return (
      <footer className="footer-minimal">
        <div className="wrap">
          <div className="footer-bottom" style={{ borderTop: "none", paddingTop: 0 }}>
            <span>{footerCopyright}</span>
            <PaymentBadges badges={paymentBadges} />
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer>
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <Logo subColor="#F0A6C0" logoImageUrl={logoImageUrl} />
            <p className="tag">{footerTagline}</p>
            <SocialLinksRow links={socialLinks} />
          </div>
          <div>
            <h4>Shop</h4>
            <ul>
              <li><Link href="/bookshelf">All books</Link></li>
              <li><Link href="/bookshelf?cat=picture">Picture books</Link></li>
              <li><Link href="/bookshelf?cat=bedtime">Bedtime stories</Link></li>
              <li><Link href="/bookshelf?cat=middle">Middle grade</Link></li>
            </ul>
          </div>
          <div>
            <h4>About</h4>
            <ul>
              <li><Link href="/about">About us</Link></li>
              <li><Link href="/authors">Authorship</Link></li>
              <li><Link href="/affiliate">Affiliate</Link></li>
              <li><Link href="/blog">Blog</Link></li>
              <li><Link href="/contact">Contact us</Link></li>
            </ul>
          </div>
          <div>
            <h4>Get involved</h4>
            <ul>
              <li><Link href="/signup/author">Become an author</Link></li>
              <li><Link href="/affiliate">Affiliate program</Link></li>
              <li><Link href="/signup/reader">Create a reader account</Link></li>
            </ul>
          </div>
          <div>
            <h4>Policies</h4>
            <ul>
              <li><Link href="/privacy">Privacy policy</Link></li>
              <li><Link href="/terms">Terms of service</Link></li>
              <li><Link href="/returns">Returns policy</Link></li>
              <li><Link href="/faq">FAQs</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{footerCopyright}</span>
          <PaymentBadges badges={paymentBadges} />
        </div>
      </div>
    </footer>
  );
}
