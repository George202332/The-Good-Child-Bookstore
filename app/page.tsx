import Link from "next/link";
import { HeroShelf } from "@/components/HeroShelf";
import { Motif } from "@/components/Motif";
import type { MotifKind } from "@/lib/data/catalog";
import { prisma } from "@/lib/prisma";
import { hashStr } from "@/lib/hash";
import { NewsletterForm } from "@/components/NewsletterForm";
import { getPagesContent } from "@/actions/page-content";
import { DEFAULT_PAGES_CONTENT } from "@/lib/page-content";

export const dynamic = "force-dynamic";
import { BookCard } from "@/components/BookCard";
import { BestSellersCarousel } from "@/components/BestSellersCarousel";
import { FadeInSection } from "@/components/FadeInSection";
import { PromoBanner } from "@/components/PromoBanner";
import { StatsBand } from "@/components/StatsBand";
import { FeaturedAuthors } from "@/components/FeaturedAuthors";
import { CATS, BOOKS } from "@/lib/data/catalog";

/**
 * Converted from homeHTML() (the-good-child-bookstore_54_1.html:3651+).
 * Remaining: "From the Journal" blog preview (needs the blog seed data
 * ported) and the newsletter signup band — next unit of work.
 */

const AGE_EXPLORER = [
  { range: "0-2", label: "Toddlers" },
  { range: "3-5", label: "Preschool" },
  { range: "6-8", label: "Early readers" },
  { range: "9-12", label: "Middle grade" },
  { range: "12-15", label: "Young teens" },
].map((a) => ({ ...a, count: BOOKS.filter((b) => b.age === a.range).length }));

const WHY_CARDS: [string, string, string][] = [
  ['<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', "High-quality books", "Every title is reviewed for print quality, illustration, and age-appropriate storytelling before it reaches the shelf."],
  ['<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z"/>', "Secure payments", "Checkout supports PayPal and Paystack (Visa, Mastercard, Amex, and Verve), with no card details ever stored on our servers."],
  ['<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>', "Instant digital downloads", "eBooks are ready in your Library the moment checkout completes, no waiting on email confirmations."],
  ['<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>', "Professional authors", "Every author on our shelf submits through an editorial review process before publication."],
  ['<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/>', "Affiliate rewards", "Anyone, reader or author, can earn commission sharing books they love through our affiliate program."],
  ['<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h6M9 11h6"/>', "Educational content", "Reading level and curriculum-friendly tags help teachers and homeschool parents plan with confidence."],
  ['<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z"/><path d="M9 12l2 2 4-4"/>', "A safe platform for kids", "No third-party ads, no unmoderated content, and every listing is age-tagged honestly."],
  ['<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>', "Excellent support", "A real, small team behind hello@thegoodchildbookstore.com; no ticket numbers, no bots."],
];

const BENEFIT_CARDS: [string, string, string][] = [
  ['<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', "Builds vocabulary", "Hearing new words in context, again and again, is one of the most effective ways children build vocabulary."],
  ['<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', "Encourages creativity", "Stories invite children to imagine worlds, characters, and outcomes far beyond the page."],
  ['<path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4.5L6 21l1.5-7.5L2 9h7Z"/>', "Builds confidence", "Finishing a book, and reading it back, gives children a real, early sense of accomplishment."],
  ['<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', "Develops imagination", "Picture books especially ask children to fill in gaps with their own mental images."],
  ['<path d="M4 19h16M7 15v4M12 10v9M17 6v13"/>', "Strengthens literacy", "Regular reading at home is one of the strongest predictors of early literacy success."],
  ['<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>', "Supports academic success", "Children who are read to regularly tend to enter school with stronger foundational skills."],
];

const BLOG_MOTIFS: MotifKind[] = ["owl", "leaf", "star", "moon", "heart", "tree"];

interface HomeBlogPost {
  slug: string;
  title: string;
  content: string;
}

export default async function HomePage() {
  const featured = BOOKS.slice(0, 12);
  const content = await getPagesContent();
  const hero = content.home;
  let blogPosts: HomeBlogPost[] = [];
  try {
    const result = await prisma.blog.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishAt: "desc" },
      take: 6,
      select: { slug: true, title: true, content: true },
    });
    if (Array.isArray(result)) blogPosts = result as HomeBlogPost[];
  } catch {
    // Degrade to no preview section rather than a 500 if the database is
    // unreachable — the rest of the homepage should still render.
  }

  return (
    <main>
      <section className="hero hero-plain">
        <div className="wrap hero-inner">
          <div className="hero-plain-inner">
            <span className="eyebrow">{hero.eyebrow}</span>
            <h1>
              {hero.heading === DEFAULT_PAGES_CONTENT.home.heading ? (
                <>Where young minds <span className="accent">fall in love</span> with reading.</>
              ) : (
                hero.heading
              )}
            </h1>
            <p className="lede">{hero.lede}</p>
            <div className="hero-ctas">
              <Link href="/shop" className="btn btn-primary">Browse the bookshelf</Link>
              <Link href="/signup/author" className="btn btn-ghost">Become an author</Link>
              <Link href="/signup/affiliate" className="btn btn-ghost">Become an affiliate</Link>
            </div>
            <div className="trust-strip" style={{ justifyContent: "flex-start", paddingTop: 26 }}>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z" />
                </svg>
                Secure checkout
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                Instant downloads
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 14l9-5-9-5-9 5 9 5Z" />
                  <path d="M3 9v6l9 5 9-5V9" />
                </svg>
                Educator-reviewed picks
              </span>
            </div>
          </div>
          <div className="hero-shelf" id="hero-shelf">
            <HeroShelf />
          </div>
        </div>
      </section>

      <FadeInSection style={{ paddingTop: 48 }}>
        <div className="wrap">
          <div className="home-search-section">
            <div className="section-head" style={{ marginBottom: 18, justifyContent: "center", textAlign: "center" }}>
              <div>
                <h2>Find the right book in seconds</h2>
                <p>Search by title, author, category, reading level, or age.</p>
              </div>
            </div>
            <div className="home-search-wrap">
              <div className="home-search-input-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx={11} cy={11} r={7} />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  className="home-search-input"
                  id="home-search-input"
                  placeholder="Try a title, an author, or 'bedtime'..."
                  autoComplete="off"
                  aria-label="Search books by title, author, category, or age"
                />
              </div>
              <div className="home-search-suggestions" id="home-search-suggestions" role="listbox" />
            </div>
            <div className="home-search-filters">
              {CATS.map((c) => (
                <Link key={c.id} href={`/shop?cat=${c.id}`} className="home-search-filter-chip">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2>Shop by shelf</h2>
              <p>Five ways into the story, sorted by age and mood.</p>
            </div>
          </div>
          <div className="cat-grid">
            {CATS.map((c) => (
              <Link key={c.id} href={`/shop?cat=${c.id}`} className={`cat-tile ${c.tile}`}>
                <svg viewBox="0 0 100 100">
                  <Motif kind={c.motif} color="#3F3350" />
                </svg>
                <span>{c.name}</span>
                <small>{c.blurb}</small>
                <span className="cat-count">{BOOKS.filter((b) => b.category === c.id).length} books</span>
              </Link>
            ))}
          </div>
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2>Best sellers &amp; new arrivals</h2>
              <p>What families are reading right now, and what just landed on the shelf.</p>
            </div>
          </div>
          <BestSellersCarousel />
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2>Shop by age</h2>
              <p>Every title is age-tagged honestly, so you always know what you&apos;re handing over.</p>
            </div>
          </div>
          <div className="age-grid">
            {AGE_EXPLORER.map((a) => (
              <Link key={a.range} href={`/shop?age=${a.range}`} className="age-card">
                <div className="age-range">{a.range}</div>
                <div className="age-label">{a.label}</div>
                <div className="age-count">{a.count} books</div>
              </Link>
            ))}
          </div>
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <PromoBanner
            tone="lavender"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="#4B3B75" strokeWidth={2}>
                <path d="M20 7h-9m0 10h9M4 7h1m-1 10h1m5-14v18" />
                <rect x={4} y={7} width={4} height={10} rx={1} />
              </svg>
            }
            title={hero.bookClubBannerTitle}
            body={hero.bookClubBannerBody}
            ctaHref="/subscription"
            ctaLabel="See the plans"
          />
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2>This week&apos;s shelf</h2>
              <p>Staff favorites, restocked every Tuesday morning.</p>
            </div>
            <Link href="/shop" className="see-all">See the full bookshelf →</Link>
          </div>
          <div className="book-grid-12">
            {featured.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <PromoBanner
            tone="mint"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="#1F5E43" strokeWidth={2}>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            }
            title={hero.printBannerTitle}
            body={hero.printBannerBody}
            ctaHref="/shop?format=print"
            ctaLabel="Shop print copies"
          />
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2>Why families choose us</h2>
              <p>Built for the people who hand books to children: parents, teachers, and librarians alike.</p>
            </div>
          </div>
          <div className="why-grid">
            {WHY_CARDS.map(([icon, title, body]) => (
              <div className="why-card" key={title}>
                <div className="why-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} dangerouslySetInnerHTML={{ __html: icon }} />
                </div>
                <h4>{title}</h4>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <StatsBand />
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2>Featured authors</h2>
              <p>Automatically ranked by rating, published books, sales, and reviews; no hand-picking.</p>
            </div>
            <Link href="/authors" className="see-all">Meet all authors →</Link>
          </div>
          <FeaturedAuthors />
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <PromoBanner
            tone="pink"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="#8A3B5A" strokeWidth={2}>
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
            title={hero.affiliateBannerTitle}
            body={hero.affiliateBannerBody}
            ctaHref="/signup/affiliate"
            ctaLabel="Become an affiliate"
          />
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2>Why reading matters</h2>
              <p>The lasting benefits behind every story on this shelf.</p>
            </div>
          </div>
          <div className="benefits-grid">
            {BENEFIT_CARDS.map(([icon, title, body]) => (
              <div className="benefit-card" key={title}>
                <div className="benefit-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} dangerouslySetInnerHTML={{ __html: icon }} />
                </div>
                <div>
                  <h4>{title}</h4>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeInSection>
      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <PromoBanner
            tone="mint"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="#245C42" strokeWidth={2}>
                <path d="M4 4h16v16H4z" />
                <path d="M4 9h16M9 4v16" />
              </svg>
            }
            title={hero.journalBannerTitle}
            body={hero.journalBannerBody}
            ctaHref="/blog"
            ctaLabel="Read the journal"
          />
        </div>
      </FadeInSection>

      {blogPosts.length > 0 && (
        <FadeInSection style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="blog-grid">
              {blogPosts.map((p) => {
                const motif = BLOG_MOTIFS[hashStr(p.slug) % BLOG_MOTIFS.length];
                return (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="blog-card">
                    <div className="blog-cover" style={{ background: "var(--lavender)" }}>
                      <svg className="motif" viewBox="0 0 100 100"><Motif kind={motif} color="#3F3350" /></svg>
                    </div>
                    <div className="blog-body">
                      <h3>{p.title}</h3>
                      <p>{p.content.slice(0, 120)}{p.content.length > 120 ? "…" : ""}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </FadeInSection>
      )}

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <NewsletterForm />
        </div>
      </FadeInSection>
    </main>
  );
}
