import Link from "next/link";
import { getPagesContent } from "@/actions/page-content";

export const dynamic = "force-dynamic";

const AFFILIATE_FAQ: [string, string][] = [
  ["Who can become an affiliate?", "Anyone passionate about children's books: readers, parents, teachers, and authors are all welcome to join."],
  ["Do I need a separate account if I am already an author?", "No, authors can enable affiliate access from their existing dashboard, no second signup required."],
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
              height: 320, overflow: "hidden", boxSizing: "border-box",
              ...(affiliateMarketing.heroImage ? { backgroundImage: `linear-gradient(rgba(20,14,26,0.4), rgba(20,14,26,0.4)), url(${affiliateMarketing.heroImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
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
            <Link href="/signup/affiliate" className="btn btn-primary btn-small">Become an affiliate</Link>
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

      <section className="section fade-in-section" id="why-join">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="section-head" style={{ marginBottom: 0, display: "block" }}>
            <h2>How the affiliate program works</h2>
            <p style={{ marginTop: 14, fontSize: 15.5, lineHeight: 1.75 }}>
              Most affiliate programs give you a link and leave you guessing whether it is working. Ours is built
              around a live dashboard, transparent commission math, and referral earnings that keep paying out
              long after the link is clicked.
            </p>
          </div>
        </div>
      </section>

      <section className="section fade-in-section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          {affiliateMarketing.sections.map((b, i) => (
            <div key={b.id}>
              <div className={`feature-banner${i % 2 === 0 ? " reverse" : ""}`}>
                <div className="feature-banner-media">
                  {b.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- real admin-uploaded section image
                    <img src={b.imageUrl} alt={b.title} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 16 }} />
                  ) : (
                    <div className="feature-banner-placeholder">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <rect x={3} y={4} width={18} height={14} rx={2} />
                        <path d="M8 20h8M12 18v2" />
                      </svg>
                      <span>{b.title}</span>
                    </div>
                  )}
                </div>
                <div className="feature-banner-copy">
                  <div className="eyebrow">Affiliate dashboard</div>
                  <h3>{b.title}</h3>
                  {b.paragraphs.map((p, pi) => <p key={pi}>{p}</p>)}
                </div>
              </div>
              {i === 3 && (
                <div className="promo-banner promo-pink" style={{ margin: "20px 0 40px" }}>
                  <div className="promo-banner-text">
                    <div className="promo-banner-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#8A3B5A" strokeWidth={2}>
                        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </div>
                    <div>
                      <h3>Ready to start earning?</h3>
                      <p>Sign up in minutes and get your first trackable link the same day.</p>
                    </div>
                  </div>
                  <Link href="/signup/affiliate" className="btn btn-primary btn-small">Become an affiliate</Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="section fade-in-section" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="section-head" style={{ marginBottom: 10 }}>
            <div><h2>Frequently asked questions</h2></div>
          </div>
          <div className="faq-list" style={{ margin: 0 }}>
            {AFFILIATE_FAQ.map(([q, a]) => (
              <details className="faq-item" key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section fade-in-section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="newsletter" style={{ justifyContent: "center", textAlign: "center", flexDirection: "column", gap: 22 }}>
            <div>
              <h2>Ready to start earning?</h2>
              <p style={{ margin: "0 auto", maxWidth: 460 }}>
                Join our affiliate program and start sharing the books you already love.
              </p>
            </div>
            <Link href="/signup/affiliate" className="btn btn-primary">Sign up as an affiliate</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
