import Link from "next/link";
import { Logo } from "./Logo";

const PAYMENT_BADGES = ["PayPal", "Mastercard", "Visa", "American Express", "Verve"];

function PaymentBadges() {
  return (
    <div className="footer-payment-badges">
      {PAYMENT_BADGES.map((b) => (
        <span key={b} className="payment-badge">
          {b}
        </span>
      ))}
    </div>
  );
}

/** Converted from footerHTML(minimal) (the-good-child-bookstore_54_1.html:3265). */
export function Footer({ minimal = false }: { minimal?: boolean }) {
  if (minimal) {
    return (
      <footer className="footer-minimal">
        <div className="wrap">
          <div className="footer-bottom" style={{ borderTop: "none", paddingTop: 0 }}>
            <span>© 2026 The Good Child Bookstore. Every cover here is invented for storytime.</span>
            <PaymentBadges />
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
            <Logo subColor="#F0A6C0" />
            <p className="tag">
              Storybooks chosen for the way they read aloud, the questions they raise at bedtime, and the
              shelf-worthy art on every cover. Trusted by parents, teachers, and school librarians.
            </p>
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
          <span>© 2026 The Good Child Bookstore. Every cover here is invented for storytime.</span>
          <PaymentBadges />
        </div>
      </div>
    </footer>
  );
}
