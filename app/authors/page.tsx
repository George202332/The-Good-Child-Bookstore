import Link from "next/link";
import { BOOKS } from "@/lib/data/catalog";
import { Motif } from "@/components/Motif";
import { getPagesContent } from "@/actions/page-content";

export const dynamic = "force-dynamic";

/** Converted from authorsHTML() (the-good-child-bookstore_54_1.html:5289-5398).
 * Hero and every feature section below it are editable from
 * /admin/site-settings (Authorship page), including each section's
 * own image. */

const AUTHORSHIP_FAQ: [string, string][] = [
  ["Do I keep the rights to my book?", "Yes. You retain full ownership of your work. Submitting a title grants us a license to sell and distribute it through this platform, nothing more."],
  ["What formats can I publish in?", "eBook, paperback, hardcover, and audiobook, all from the same submission, using the same author dashboard."],
  ["How and when do I get paid?", "Royalties are calculated in real time and summarized in a downloadable report every month, with transparent, itemized numbers."],
  ["Can I also become an affiliate?", "Yes, using the same account. Authors can enable affiliate access from their dashboard with no separate signup."],
  ["Is there a cost to publish?", "No upfront cost to publish. Print copies are produced on demand through our print partner, so there is no inventory to buy."],
  ["How long does review take?", "Most submissions are reviewed within a few business days. You can track the status from your author dashboard the whole time."],
];

export default async function AuthorsPage() {
  const authorCount = new Set(BOOKS.map((b) => b.author)).size;
  const content = await getPagesContent();
  const { authorship } = content;

  return (
    <main>
      <section className="hero recruit-hero fade-in-section visible">
        <div className="wrap hero-inner">
          <div className="hero-plain-inner">
            <div className="eyebrow">{authorship.eyebrow}</div>
            <h1>{authorship.heading}</h1>
            <p className="lede">{authorship.introText}</p>
            <div className="hero-ctas">
              <Link href="/signup/author" className="btn btn-primary">Become an author</Link>
              <a href="#why-publish" className="btn btn-ghost">See how it works</a>
            </div>
          </div>
          <div className="hero-float-cluster">
            <div className="hero-float-icon" style={{ width: 120, height: 120, background: "var(--lavender)", top: 10, left: 40, animationDelay: "0s" }}>
              <svg viewBox="0 0 100 100"><Motif kind="star" color="#4B3B75" /></svg>
            </div>
            <div className="hero-float-icon" style={{ width: 90, height: 90, background: "var(--mint)", top: 70, right: 30, animationDelay: "0.6s" }}>
              <svg viewBox="0 0 100 100"><Motif kind="leaf" color="#1F5E43" /></svg>
            </div>
            <div className="hero-float-icon" style={{ width: 100, height: 100, background: "var(--pink)", bottom: 90, left: 110, animationDelay: "1.2s" }}>
              <svg viewBox="0 0 100 100"><Motif kind="heart" color="#8A3B5A" /></svg>
            </div>
            <div className="hero-float-icon" style={{ width: 80, height: 80, background: "var(--gold)", top: 180, left: 0, animationDelay: "1.8s" }}>
              <svg viewBox="0 0 100 100"><Motif kind="owl" color="#7A5A0A" /></svg>
            </div>
            <div className="hero-float-icon" style={{ width: 96, height: 96, background: "#FFDCC9", bottom: 20, right: 70, animationDelay: "0.3s" }}>
              <svg viewBox="0 0 100 100"><Motif kind="sun" color="#A8452B" /></svg>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ padding: "8px 0 0" }}>
        <div className="trust-strip" style={{ justifyContent: "flex-start" }}>
          <span>✓ {authorCount}+ authors already publishing with us</span>
          <span>✓ {BOOKS.length}+ titles on the shelf</span>
          <span>✓ Real-time sales, every account</span>
        </div>
      </div>

      <section className="section fade-in-section" id="why-publish">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="section-head" style={{ marginBottom: 0, display: "block" }}>
            <h2>Why authors publish with us</h2>
            <p style={{ marginTop: 14, fontSize: 15.5, lineHeight: 1.75 }}>
              Most self-publishing platforms hand you a spreadsheet and call it a dashboard. We built ours the way
              we wish existed when we started: real numbers, updated as they happen, explained in plain language,
              with the rest of the busywork handled for you. Below is a walk-through of what that actually looks
              like once you are publishing with us, screenshot by screenshot.
            </p>
          </div>
        </div>
      </section>

      <section className="section fade-in-section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          {authorship.sections.map((b, i) => (
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
                  <div className="eyebrow">Author dashboard</div>
                  <h3>{b.title}</h3>
                  {b.paragraphs.map((p, pi) => <p key={pi}>{p}</p>)}
                </div>
              </div>
              {i === 3 && (
                <div className="promo-banner promo-mint" style={{ margin: "20px 0 40px" }}>
                  <div className="promo-banner-text">
                    <div className="promo-banner-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#1F5E43" strokeWidth={2}>
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </div>
                    <div>
                      <h3>Ready to see your book on the shelf?</h3>
                      <p>Start your submission today; your manuscript and cover are all it takes to begin.</p>
                    </div>
                  </div>
                  <Link href="/signup/author" className="btn btn-primary btn-small">Become an author</Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="section fade-in-section" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 920 }}>
          <div className="section-head" style={{ marginBottom: 22, display: "block" }}>
            <h2>Author success stories</h2>
            <p style={{ marginTop: 10 }}>Real stories from authors publishing with us are on their way.</p>
          </div>
          <div className="quote-grid">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div className="testimonial-placeholder" key={n}>
                <div className="ph-avatar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx={12} cy={8} r={3.6} /><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
                  </svg>
                </div>
                <p>This space is reserved for a future author success story.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section fade-in-section" style={{ paddingTop: 0 }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="section-head" style={{ marginBottom: 10 }}>
            <div><h2>Frequently asked questions</h2></div>
          </div>
          <div className="faq-list" style={{ margin: 0 }}>
            {AUTHORSHIP_FAQ.map(([q, a]) => (
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
              <h2>Ready to share your story with the world?</h2>
              <p style={{ margin: "0 auto", maxWidth: 460 }}>
                Join the authors already publishing eBooks, print, and audiobooks through The Good Child Bookstore.
              </p>
            </div>
            <Link href="/signup/author" className="btn btn-primary">Create your author account</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
