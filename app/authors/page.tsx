import Link from "next/link";
import { BOOKS } from "@/lib/data/catalog";
import { Motif } from "@/components/Motif";

/** Converted from authorsHTML() (the-good-child-bookstore_54_1.html:5289-5398).
 * This was never converted in the initial build — 404 in production until now. */

const AUTHORSHIP_SECTIONS: { title: string; paragraphs: string[]; list?: string[]; followup: string }[] = [
  {
    title: "Publish in every format",
    paragraphs: [
      "Every title you submit can be published as an eBook, a paperback, a hardcover, and an audiobook, all from the same manuscript and the same dashboard. You are not juggling four different tools, four different accounts, or four different review processes to reach readers who prefer different formats.",
      "Choose which formats to enable per title, set your own print trim size and cover finish, and adjust pricing independently for each format at any time, without resubmitting anything.",
    ],
    followup:
      "This matters more than it might first seem. A reader who wants an audiobook for the car, a parent who wants an eBook for a tablet at bedtime, and a teacher who wants a classroom paperback are all looking at the same title page, and none of them has to settle for the \"wrong\" format simply because it happened to be the only one you got around to publishing first. Enabling a new format later, once you notice demand for it in your dashboard, takes minutes rather than a whole new submission, a new review cycle, or a second cover upload. Over time, most authors on the platform end up publishing in at least two formats, often without planning to at the start, simply because a reader asked.",
  },
  {
    title: "Real-time sales tracking",
    paragraphs: [
      "The moment a reader buys your book, it shows up in your dashboard. There is no overnight batch job and no waiting for a report to refresh: sales, downloads, and format breakdowns update as they happen.",
      "You can check in from your phone between errands and actually see whether today's promotion is working, instead of finding out three weeks from now when a statement finally arrives.",
    ],
    followup:
      "For a launch day in particular, that immediacy changes how you actually use your time. If a particular post, newsletter mention, or classroom visit is clearly driving sales, you can lean into it that same afternoon, sharing it again or following up with the same audience, instead of finding out three weeks later that the momentum has already passed and the moment is gone. Many authors describe the first hour after a promotion goes out as the most useful hour to be watching, and a delayed report simply cannot support that.",
  },
  {
    title: "Complete revenue transparency and a live performance dashboard",
    paragraphs: [
      "Every royalty calculation is shown in full: the price paid, the platform's share, and your share, for every single sale. Nothing is bundled into a vague \"net revenue\" figure you have to take on faith, and if a sale came through an affiliate link, you can see exactly how that commission was split.",
      "Alongside the money, the same dashboard lays out revenue, unit sales, downloads, unique readers, and the countries your readers are in, with trend lines showing whether a title is picking up or slowing down.",
    ],
    list: ["Revenue and unit sales, by title", "Downloads and unique readers", "Countries reached", "Performance trend lines over time"],
    followup:
      "Together, the numbers and the trends on this screen are meant to answer the two questions every author actually has, in plain terms rather than raw data: exactly how much did I earn, and is this particular book's audience growing, holding steady, or fading. Neither question should require you to keep a spreadsheet of your own, cross-reference old statements, or estimate based on a gut feeling about how sales \"seem\" to be going. The dashboard is built so that a five-minute glance, once a week, tells you as much as an afternoon of your own bookkeeping used to.",
  },
  {
    title: "Monthly downloadable reports and secure payments",
    paragraphs: [
      "Alongside the live dashboard, a clean report is generated automatically at the end of every month, covering everything that sold, where it sold, and exactly what you earned from it, ready to download as a PDF for your own records or to hand to an accountant.",
      "Payouts themselves are processed through the same secure infrastructure that handles customer checkout at the front of the store. Your banking details are never stored in plain text, and every payout is logged in your account history for as long as you need to refer back to it.",
    ],
    followup:
      "The monthly report and the payout that follows it are meant to line up exactly, down to the cent, so reconciling your own books is a matter of matching two numbers side by side rather than reconstructing an entire month from memory or from scattered dashboard screenshots. If you work with an accountant or simply like to keep your own records tidy, the report is written to be handed over as-is, with sales, formats, and earnings already broken out in a way that needs no further explanation from you.",
  },
  {
    title: "You keep ownership of your work",
    paragraphs: [
      "Submitting a title to The Good Child Bookstore does not transfer ownership of it. You retain full rights to your manuscript and illustrations; publishing here grants us a license to sell and distribute the book on your behalf, and nothing more.",
      "You remain free to publish the same title elsewhere, and to remove it from our shelf whenever you choose.",
    ],
    followup:
      "We take this seriously enough to say it plainly here rather than bury it in a terms page you might never read: this is a distribution and sales relationship, not a rights transfer, and it stays that way for as long as your book is with us. That means you can pursue a traditional deal, sell direct from your own site, or simply change your mind later, all without asking our permission first. A platform that only works if you never leave is not one we think authors should have to trust, so we built ours so that leaving is always straightforward.",
  },
  {
    title: "An easy publishing workflow and a modern author dashboard",
    paragraphs: [
      "Upload a manuscript and a cover, answer a short set of questions about age range and category, and we handle formatting and print setup from there. A built-in checklist walks you through print specifications, back-cover copy, and ISBN details, so nothing gets missed before a title goes live.",
      "Once it is live, submissions, sales, messages from readers, and your blog posts all sit in the same dashboard, built to be checked in a few spare minutes rather than managed like a second job. Notifications let you know when a submission is reviewed, when a reader leaves a message, or when a payout is on its way.",
    ],
    followup:
      "The goal throughout the whole submission and dashboard experience is the same: the parts that are genuinely your job, the writing, the illustrating, the deciding what to publish next, stay entirely yours, while the parts that are just paperwork, formatting for four different formats, print specifications, ISBN assignment, and back-cover layout, are handled for you in the background. Most authors tell us the workflow feels less like using software and more like handing a manuscript to a very organized assistant who happens to also run the print shop.",
  },
  {
    title: "Affiliate integration, no extra account",
    paragraphs: [
      "Every author account can also earn as an affiliate, sharing books (including books by other authors on the shelf) and earning commission on the sales that follow, without ever creating a second login.",
      "Enable affiliate access from your existing dashboard whenever you are ready to start referring readers; your author tools stay exactly where they are.",
    ],
    followup:
      "A lot of authors already recommend other books they love, in newsletters, on social media, or simply in conversation with other writers; this feature simply means that recommendation can also earn you something, using the exact account you already have, with no new password to remember and no separate dashboard to check. If you read widely within children's literature anyway, which most authors on this shelf do, turning that reading into a small secondary income is mostly a matter of flipping a switch rather than starting something new from scratch.",
  },
  {
    title: "Print-on-demand, worldwide distribution, and your professional profile",
    paragraphs: [
      "Paperback and hardcover copies are produced through our print partner, Lulu, on a print-on-demand basis. There is no print run to pay for upfront and no boxes of unsold inventory taking up space in your home; a copy is only printed once a customer orders it, and shipped directly to them, wherever they are.",
      "Once a title is live, it is available to readers everywhere we operate, with no additional setup or regional pricing tables to fill in, and it sits on a professional profile page, alongside your bio, your photo, and your full catalog, that readers, teachers, and librarians can actually browse and follow.",
    ],
    followup:
      "Between print-on-demand production and worldwide digital availability, the usual reasons a small press or an independent author might hesitate to reach a particular country or a particular format simply do not apply here. There is no inventory risk to weigh, no shipping warehouse to arrange, and no separate setup or paperwork required per market you want to reach. A reader in a country you have never shipped to before can order a paperback of your book on the same terms as a reader down the street, and the first you will likely hear of it is the sale itself appearing in your dashboard.",
  },
];

const AUTHORSHIP_FAQ: [string, string][] = [
  ["Do I keep the rights to my book?", "Yes. You retain full ownership of your work. Submitting a title grants us a license to sell and distribute it through this platform, nothing more."],
  ["What formats can I publish in?", "eBook, paperback, hardcover, and audiobook, all from the same submission, using the same author dashboard."],
  ["How and when do I get paid?", "Royalties are calculated in real time and summarized in a downloadable report every month, with transparent, itemized numbers."],
  ["Can I also become an affiliate?", "Yes, using the same account. Authors can enable affiliate access from their dashboard with no separate signup."],
  ["Is there a cost to publish?", "No upfront cost to publish. Print copies are produced on demand through our print partner, so there is no inventory to buy."],
  ["How long does review take?", "Most submissions are reviewed within a few business days. You can track the status from your author dashboard the whole time."],
];

export default function AuthorsPage() {
  const authorCount = new Set(BOOKS.map((b) => b.author)).size;

  return (
    <main>
      <section className="hero recruit-hero fade-in-section visible">
        <div className="wrap hero-inner">
          <div className="hero-plain-inner">
            <div className="eyebrow">✦ Authorship</div>
            <h1>Publish your story. <span className="accent">Keep the rights.</span></h1>
            <p className="lede">
              Join the children&apos;s authors already publishing eBooks, print, and audiobooks through The Good
              Child Bookstore, with real-time sales tracking, transparent royalties, and a modern dashboard built
              for writers, not spreadsheets.
            </p>
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
          {AUTHORSHIP_SECTIONS.map((b, i) => (
            <div key={b.title}>
              <div className={`feature-banner${i % 2 === 0 ? " reverse" : ""}`}>
                <div className="feature-banner-media">
                  <div className="feature-banner-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <rect x={3} y={4} width={18} height={14} rx={2} />
                      <path d="M8 20h8M12 18v2" />
                    </svg>
                    <span>Author Dashboard screenshot — {b.title}</span>
                  </div>
                </div>
                <div className="feature-banner-copy">
                  <div className="eyebrow">Author dashboard</div>
                  <h3>{b.title}</h3>
                  {b.paragraphs.map((p, pi) => <p key={pi}>{p}</p>)}
                  {b.list && (
                    <ul>
                      {b.list.map((li) => (
                        <li key={li}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 6L9 17l-5-5" /></svg>
                          {li}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {b.followup && <div className="feature-banner-followup"><p>{b.followup}</p></div>}
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
