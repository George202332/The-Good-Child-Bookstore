import Link from "next/link";
import { Motif } from "@/components/Motif";

/** Converted from affiliateMarketingHTML() (the-good-child-bookstore_54_1.html:5443-5549).
 * This was never converted in the initial build — 404 in production until now. */

const AFFILIATE_SECTIONS: { title: string; paragraphs: string[]; followup: string }[] = [
  {
    title: "Earn commission on every sale you refer",
    paragraphs: [
      "Every affiliate account comes with a unique link for any book on the shelf. When someone buys through your link, a share of that sale is credited to you automatically, no manual tracking or spreadsheets required on your end.",
      "You can see exactly which books, which links, and which days are earning the most, so you know where to put your effort next.",
    ],
    followup:
      "It is worth saying plainly, because it surprises a lot of people who join: you do not need a following of any particular size to start earning through this program. A single well-placed recommendation, shared in a classroom newsletter, a parents' group chat, or a small local book club, works exactly the same way, mechanically, as a link shared with a much larger audience online. What tends to matter more than audience size is relevance: a handful of the right readers, at the right moment, will often convert better than a much larger but less interested crowd.",
  },
  {
    title: "Lifetime commissions from the authors you refer",
    paragraphs: [
      "Referring authors works differently, and better, than referring a single sale. Refer a writer who joins the platform, and you continue earning a share of their sales for as long as they keep publishing with us, not just for the first purchase.",
      "That means a single good referral can keep paying out for years, quietly compounding in the background while you focus on other things.",
    ],
    followup:
      "This is the part of the program most people underestimate the first time they read about it: the effort required on your end is a single introduction, one conversation or one shared link, and the earnings that follow are ongoing, tied to that author's entire career on the platform rather than to a single transaction that is over the moment it happens. An author you introduced two years ago, who is still quietly publishing new titles today, is still generating a commission for you today as well, without you having to do anything further to keep it going.",
  },
  {
    title: "A real-time earnings dashboard and live commission tracking",
    paragraphs: [
      "Clicks, conversions, and commission all appear in your dashboard as they happen, rather than in a delayed monthly export. You can watch a shared link start converting in real time and know, that same day, whether a post or a promotion actually worked.",
      "Every referral is logged the moment it happens, with the exact commission calculation attached to it, so there is never a gap between a sale occurring and you being able to see it.",
    ],
    followup:
      "For anyone running more than one promotion at a time, across different books or different channels, that immediacy is what actually makes a fair comparison possible: you are looking at the same day's numbers for each one, side by side, rather than guessing based on totals collected over very different time periods and conditions. Without that, it is easy to conclude the wrong promotion \"worked\" simply because it happened to run for longer or during a busier week, when in fact a shorter, better-targeted push performed better per click. Seeing both on the same screen, updated at the same moment, is what makes that comparison fair in the first place.",
  },
  {
    title: "Your referral dashboard",
    paragraphs: [
      "One screen brings together every reader and every author you have referred, what each one has generated, and how that adds up over time.",
      "You do not need to reconstruct your own records from memory; the dashboard keeps the full history for you.",
    ],
    followup:
      "Because reader referrals and author referrals behave quite differently in practice, one is a one-off commission tied to a single purchase, the other is an ongoing lifetime share of everything an author sells afterward, the dashboard keeps the two clearly separated rather than blending them into one combined total. That way you always know, at a glance, which kind of income you are looking at, and roughly how it is likely to behave over the months ahead: a short-lived spike from a shared link, or a slow, steady trickle from an author you introduced a while back.",
  },
  {
    title: "Monthly payout reports and transparent accounting",
    paragraphs: [
      "Every commission calculation is visible before it is paid, broken down by referral, so nothing is bundled into a single unexplained number.",
      "At the end of each month, that detail is summarized into a clean, downloadable report you can keep for your own records or hand to an accountant.",
    ],
    followup:
      "The monthly report and the live dashboard are always meant to agree with each other exactly, down to the last referral; if you have been watching a number climb steadily all month on your phone, the formal report that lands at the end of it should hold no surprises, no unexplained adjustments, and no figure you cannot trace back to a specific click or sale. Accounting you can quietly double-check yourself, at any point in the month, is the entire point of showing the math this openly in the first place.",
  },
  {
    title: "Referral performance and analytics",
    paragraphs: [
      "See which links, campaigns, and channels are actually converting, down to the click, so you can put more effort behind what is working and quietly retire what is not.",
      "Trends over time show whether a particular promotion is worth repeating.",
    ],
    followup:
      "Over a few months of watching this data build up, this is usually what turns a casual affiliate into a genuinely strategic one: you stop guessing which channel, which kind of post, or which time of week works best for you personally, and start knowing it, directly from your own numbers rather than from generic advice about what \"usually\" works for other people. Two affiliates sharing the same books can end up with very different winning strategies once they actually look at their own data instead of assuming their audience behaves like everyone else's.",
  },
  {
    title: "Marketing resources, ready to use",
    paragraphs: [
      "Ready-made banners, cover images, and suggested copy are available for every book on the shelf, so you are never starting a promotion from a blank page.",
      "Everything is sized and formatted for the platforms affiliates actually use: social posts, newsletters, and classroom handouts alike.",
    ],
    followup:
      "None of this is required of you; you are always entirely free to write your own copy, take your own photographs, and design your own promotional posts from scratch if that is what you would rather do. The ready-made resources exist for the far more common days when you would rather spend five minutes sharing a book you already love than an hour designing a post about it, and for affiliates who are earning steadily on the side of a full-time job, that saved hour tends to be the difference between promoting a book this week and simply meaning to get to it eventually.",
  },
  {
    title: "Promotional links, QR codes, social sharing, and no separate author account",
    paragraphs: [
      "A trackable link is generated instantly for any book, along with a scannable QR code for flyers, classrooms, and in-person events, and one-tap sharing sends your link straight to the platforms your audience already uses, tracking already built in.",
      "If you already publish with us as an author, none of this requires a second login either: enable affiliate access from your existing dashboard, and both sets of tools live in the same place from then on.",
    ],
    followup:
      "Whether you come to the affiliate program as a reader who loves recommending books, a teacher sharing titles with parents, or an author who already has an account for publishing, the tools you get are the same ones: the same trackable links, the same QR codes, the same one-tap sharing. All of it reports back to the single dashboard you are already using, so there is never a second login to remember, a second set of numbers to reconcile, or a second inbox to check for updates on how things are going.",
  },
];

const AFFILIATE_FAQ: [string, string][] = [
  ["Who can become an affiliate?", "Anyone passionate about children's books: readers, parents, teachers, and authors are all welcome to join."],
  ["Do I need a separate account if I am already an author?", "No. Authors can enable affiliate access from their existing dashboard, no second signup required."],
  ["How is my commission calculated?", "Every sale referred through your link is tracked automatically, with the calculation visible in your dashboard before it is paid."],
  ["What are lifetime referral earnings?", "If you refer an author who joins the platform, you continue earning a share of their sales for as long as they publish with us."],
  ["How and when do I get paid?", "Payouts are summarized in a downloadable monthly report, with transparent, itemized numbers."],
  ["What marketing tools are provided?", "Trackable links, QR codes, ready-made banners, and social-ready assets are generated automatically for every book."],
];

export default function AffiliateMarketingPage() {
  return (
    <main>
      <section className="hero recruit-hero fade-in-section visible">
        <div className="wrap hero-inner">
          <div className="hero-plain-inner">
            <div className="eyebrow">✦ Affiliate program</div>
            <h1>Share books you love. <span className="accent">Get paid for it.</span></h1>
            <p className="lede">
              Anyone passionate about children&apos;s books can earn commission promoting titles from our shelf,
              with a real-time dashboard, transparent payouts, and lifetime earnings from the authors you refer.
            </p>
            <div className="hero-ctas">
              <Link href="/signup/affiliate" className="btn btn-primary">Become an affiliate</Link>
              <a href="#why-join" className="btn btn-ghost">See how it works</a>
            </div>
          </div>
          <div className="hero-float-cluster">
            <div className="hero-float-icon" style={{ width: 120, height: 120, background: "var(--mint)", top: 10, left: 40, animationDelay: "0s" }}>
              <svg viewBox="0 0 100 100"><Motif kind="leaf" color="#1F5E43" /></svg>
            </div>
            <div className="hero-float-icon" style={{ width: 90, height: 90, background: "var(--gold)", top: 70, right: 30, animationDelay: "0.6s" }}>
              <svg viewBox="0 0 100 100"><Motif kind="sun" color="#7A5A0A" /></svg>
            </div>
            <div className="hero-float-icon" style={{ width: 100, height: 100, background: "var(--pink)", bottom: 90, left: 110, animationDelay: "1.2s" }}>
              <svg viewBox="0 0 100 100"><Motif kind="heart" color="#8A3B5A" /></svg>
            </div>
            <div className="hero-float-icon" style={{ width: 80, height: 80, background: "var(--lavender)", top: 180, left: 0, animationDelay: "1.8s" }}>
              <svg viewBox="0 0 100 100"><Motif kind="star" color="#4B3B75" /></svg>
            </div>
            <div className="hero-float-icon" style={{ width: 96, height: 96, background: "#FFDCC9", bottom: 20, right: 70, animationDelay: "0.3s" }}>
              <svg viewBox="0 0 100 100"><Motif kind="rainbow" color="#A8452B" /></svg>
            </div>
          </div>
        </div>
      </section>

      <div className="wrap" style={{ padding: "8px 0 0" }}>
        <div className="trust-strip" style={{ justifyContent: "flex-start" }}>
          <span>✓ No separate account needed for authors</span>
          <span>✓ Real-time commission tracking</span>
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
              long after the link is clicked. Below is a walk-through of what that looks like once you are set up,
              screenshot by screenshot.
            </p>
          </div>
        </div>
      </section>

      <section className="section fade-in-section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          {AFFILIATE_SECTIONS.map((b, i) => (
            <div key={b.title}>
              <div className={`feature-banner${i % 2 === 0 ? " reverse" : ""}`}>
                <div className="feature-banner-media">
                  <div className="feature-banner-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <rect x={3} y={4} width={18} height={14} rx={2} />
                      <path d="M8 20h8M12 18v2" />
                    </svg>
                    <span>Affiliate Dashboard screenshot — {b.title}</span>
                  </div>
                </div>
                <div className="feature-banner-copy">
                  <div className="eyebrow">Affiliate dashboard</div>
                  <h3>{b.title}</h3>
                  {b.paragraphs.map((p, pi) => <p key={pi}>{p}</p>)}
                </div>
              </div>
              {b.followup && <div className="feature-banner-followup"><p>{b.followup}</p></div>}
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
        <div className="wrap" style={{ maxWidth: 920 }}>
          <div className="section-head" style={{ marginBottom: 22, display: "block" }}>
            <h2>Affiliate success stories</h2>
            <p style={{ marginTop: 10 }}>Real stories from affiliates earning with us are on their way.</p>
          </div>
          <div className="quote-grid">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div className="testimonial-placeholder" key={n}>
                <div className="ph-avatar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx={12} cy={8} r={3.6} /><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
                  </svg>
                </div>
                <p>This space is reserved for a future affiliate success story.</p>
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
