import Link from "next/link";
import { getPagesContent } from "@/actions/page-content";

export const dynamic = "force-dynamic";

const AFFILIATE_FAQ: [string, string][] = [
  ["Do I need to sign up as an affiliate separately?", "No — there is no separate affiliate signup. Create a Reader or Author account (whichever describes you), then enable affiliate access from your dashboard whenever you're ready."],
  ["Who can become an affiliate?", "Anyone passionate about children's books: readers, parents, teachers, and authors are all welcome to join, using their existing Reader or Author account."],
  ["How is my commission calculated?", "Every sale referred through your link is tracked automatically, with the calculation visible in your dashboard before it is paid."],
  ["What are lifetime referral earnings?", "If you refer an author who joins the platform, you continue earning a share of their sales for as long as they publish with us."],
  ["How and when do I get paid?", "Payouts are summarized in a downloadable monthly report, with transparent, itemized numbers."],
  ["What marketing tools are provided?", "Trackable links, QR codes, ready made banners, and social ready assets are generated automatically for every book."],
];

/**
 * The Affiliate marketing/landing page — the hero and every section
 * below it are fully admin editable (Admin → Page Content → Affiliate
 * page), including each section's own image.
 */
export default async function AffiliateMarketingPage() {
  const { affiliateMarketing } = await getPagesContent();
  return (
    <main>
      <section className="fade-in-section visible" style={{ paddingTop: "0.5in" }}>
        <div className="wrap">
          <div
            className="promo-banner promo-mint"
            style={{
              height: 352, overflow: "hidden", boxSizing: "border-box",
              ...(affiliateMarketing.heroImage ? { backgroundImage: `linear-gradient(rgba(20,14,26,0.58), rgba(20,14,26,0.58)), url(${affiliateMarketing.heroImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
            }}
          >
            <div className="promo-banner-text">
              <div className="promo-banner-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#1F5E43" strokeWidth={2}><path d="M9 15l6-6" /><path d="M10 6.5h-.5A4.5 4.5 0 0 0 5 11v.5" /><path d="M14 17.5h.5A4.5 4.5 0 0 0 19 13v-.5" /></svg>
              </div>
              <div>
                <h3 style={affiliateMarketing.heroImage ? { color: "#fff" } : undefined}>{affiliateMarketing.heading}</h3>
                <p style={affiliateMarketing.heroImage ? { color: "rgba(255,255,255,0.9)" } : undefined}>{affiliateMarketing.introText}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/signup/reader" className="btn btn-primary btn-small">Sign up as a reader</Link>
              <Link href="/signup/author" className="btn btn-ghost btn-small">Sign up as an author</Link>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ padding: "8px 0 0" }}>
        <div className="trust-strip" style={{ justifyContent: "flex-start" }}>
          <span>✓ No separate account needed for authors</span>
          <span>✓ Real time commission tracking</span>
          <span>✓ Lifetime earnings on referred authors</span>
        </div>
      </div>

      <section className="section fade-in-section visible" id="why-join">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 0, display: "block" }}>
            <h2>How the affiliate program works</h2>
            <p style={{ marginTop: 14, fontSize: 15.5, lineHeight: 1.75 }}>
              Most affiliate programs give you a link and leave you guessing whether it is working. Ours is built
              around a live dashboard, transparent commission math, and referral earnings that keep paying out
              long after the link is clicked. There is no separate affiliate account to create — it comes built
              into your Reader or Author account, turned on from your dashboard whenever you&apos;re ready.
            </p>
          </div>
        </div>
      </section>

      <section className="section fade-in-section visible" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="page-body-content" dangerouslySetInnerHTML={{ __html: affiliateMarketing.bodyHtml }} />
        </div>
      </section>

      <section className="section fade-in-section visible" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div
            className="promo-banner promo-lavender"
            style={{ height: 352, overflow: "hidden", boxSizing: "border-box", justifyContent: "center", flexDirection: "column", gap: 20 }}
          >
            <div className="promo-banner-text">
              <div className="promo-banner-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#3A2C62" strokeWidth={2}>
                  <path d="M9 15l6-6" /><path d="M10 6.5h-.5A4.5 4.5 0 0 0 5 11v.5" /><path d="M14 17.5h.5A4.5 4.5 0 0 0 19 13v-.5" />
                </svg>
              </div>
              <h3 style={{ fontSize: 26 }}>Start earning as an affiliate</h3>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <Link href="/signup/reader" className="btn btn-primary">Sign up as a reader</Link>
              <Link href="/signup/author" className="btn btn-ghost">Sign up as an author</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section fade-in-section visible" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 10 }}>
            <div><h2>Frequently asked questions</h2></div>
          </div>
          <div className="faq-list" style={{ margin: 0, maxWidth: "none" }}>
            {AFFILIATE_FAQ.map(([q, a]) => (
              <details className="faq-item" key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section fade-in-section visible" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="newsletter" style={{ justifyContent: "center", textAlign: "center", flexDirection: "column", gap: 22 }}>
            <div>
              <h2>Ready to start earning?</h2>
              <p style={{ margin: "0 auto", maxWidth: 460 }}>
                Join as a Reader or an Author and enable affiliate access from your dashboard — no separate signup.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <Link href="/signup/reader" className="btn btn-primary">Create a reader account</Link>
              <Link href="/signup/author" className="btn btn-ghost">Create an author account</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
