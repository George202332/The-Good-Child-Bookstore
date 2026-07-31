import Link from "next/link";
import { Logo } from "./Logo";
import { PaymentBadgeIcon } from "./PaymentBadgeIcon";
import { DEFAULT_SITE_SETTINGS, type PaymentBadgeUrls } from "@/lib/site-settings";

const PAYMENT_BADGE_LABELS: { key: keyof PaymentBadgeUrls; label: string }[] = [
  { key: "mpesa", label: "M-Pesa" },
  { key: "mastercard", label: "Mastercard" },
  { key: "visa", label: "Visa" },
  { key: "amex", label: "American Express" },
  { key: "verve", label: "Verve" },
];

/** Renders each payment badge as an admin-uploaded image if one is set
 * (/admin/site-settings), otherwise a real card-style icon (see
 * PaymentBadgeIcon.tsx) — no more plain text placeholders. */
function PaymentBadges({ badges }: { badges: PaymentBadgeUrls }) {
  return (
    <div className="footer-payment-badges">
      {PAYMENT_BADGE_LABELS.map(({ key, label }) =>
        badges[key] ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded badge image, not a static asset
          <img key={key} src={badges[key]} alt={label} className="payment-badge-img" style={{ height: 22 }} />
        ) : (
          <PaymentBadgeIcon key={key} type={key} />
        )
      )}
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
}: {
  minimal?: boolean;
  logoImageUrl?: string;
  footerTagline?: string;
  footerCopyright?: string;
  paymentBadges?: PaymentBadgeUrls;
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
            <div className="footer-social">
              <a href="#" aria-label="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 22v-9h3l1-4h-4V6.5c0-1.1.5-2 2-2h2V.3S15.5 0 14 0c-3 0-5 1.8-5 5.2V9H6v4h3v9h4Z" />
                </svg>
              </a>
              <a href="#" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" />
                </svg>
              </a>
              <a href="#" aria-label="Pinterest">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9 20c1-3 2-8 2-8m4-4a3 3 0 1 1-3 3c0-2 1-4 4-4" />
                </svg>
              </a>
              <a href="#" aria-label="YouTube">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="3" />
                  <path d="M10 9l5 3-5 3z" />
                </svg>
              </a>
            </div>
          </div>
          <div>
            <h4>Shop</h4>
            <ul>
              <li><Link href="/shop">All books</Link></li>
              <li><Link href="/shop?cat=picture">Picture books</Link></li>
              <li><Link href="/shop?cat=bedtime">Bedtime stories</Link></li>
              <li><Link href="/shop?cat=middle">Middle grade</Link></li>
            </ul>
          </div>
          <div>
            <h4>About</h4>
            <ul>
              <li><Link href="/about">About us</Link></li>
              <li><Link href="/authors">Authorship</Link></li>
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
              <li><Link href="/subscription">Subscription plans</Link></li>
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
