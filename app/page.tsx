import Link from "next/link";
import { HeroBannerCarousel } from "@/components/HeroBannerCarousel";
import { Motif } from "@/components/Motif";
import type { MotifKind } from "@/lib/data/catalog";
import { prisma } from "@/lib/prisma";
import { hashStr } from "@/lib/hash";
import { selectHomeBlogs } from "@/lib/blog-ranking";
import { NewsletterForm } from "@/components/NewsletterForm";
import { getPagesContent } from "@/actions/page-content";
import { getRealPublishedBooks, getPublishedCategoryCounts } from "@/lib/data/real-books-adapter";
import { DEFAULT_PAGES_CONTENT } from "@/lib/page-content";

export const dynamic = "force-dynamic";
import { BookCard } from "@/components/BookCard";
import { BestSellersCarousel } from "@/components/BestSellersCarousel";
import { getRotatingBatch } from "@/lib/rotating-batch";
import { FadeInSection } from "@/components/FadeInSection";
import { PromoBanner } from "@/components/PromoBanner";
import { StatsBand } from "@/components/StatsBand";
import { FeaturedAuthors } from "@/components/FeaturedAuthors";
import { CATS, BOOKS } from "@/lib/data/catalog";
import { CATEGORIES, categorySlug } from "@/lib/taxonomy";
import { CATEGORY_BLURBS } from "@/lib/data/category-blurbs";
import { categoryThemeStyle } from "@/lib/category-colors";
import { bookCountLabel } from "@/lib/category-counts";
import { getVisitorCountries } from "@/lib/visitor-country";
import { getPlatformStats } from "@/lib/platform-stats";
import { LiveRefresher } from "@/components/LiveRefresher";

/**
 * Converted from homeHTML() (the-good-child-bookstore_54_1.html:3651+).
 * The "From the Journal" preview is dynamic: it shows only real
 * published posts, chosen by lib/blog-ranking.ts (newest 6 until at
 * least 6 posts have enough reads/comments, then the 6 most engaged),
 * with a link through to the full blog at /blog.
 */

// Ranges/labels only here — counts are computed per-request in HomePage
// below from the real, live catalog (real published books + the demo
// catalog combined, the same set the Shop by Age link actually filters
// to on /bookshelf), not from a snapshot taken once at module load.
const AGE_EXPLORER_BASE = [
  { range: "0-2", label: "Toddlers" },
  { range: "3-5", label: "Preschool" },
  { range: "6-8", label: "Early readers" },
  { range: "9-12", label: "Middle grade" },
  { range: "12-15", label: "Young teens" },
];

const WHY_CARDS: [string, string, string][] = [
  ['<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', "High-quality books", "Every title is reviewed for print quality, illustration, and age-appropriate storytelling before it reaches the shelf."],
  ['<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z"/>', "Secure payments", "Checkout supports cards via Paystack (Visa, Mastercard, Amex, and Verve), with no card details ever stored on our servers."],
  ['<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>', "Instant digital downloads", "eBooks are ready in your Library the moment checkout completes, no waiting on email confirmations."],
  ['<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>', "Professional authors", "Every author on our shelf submits through an editorial review process before publication."],
  ['<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/>', "Affiliate rewards", "Anyone, reader or author, can earn commission sharing books they love through our affiliate program."],
  ['<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h6M9 11h6"/>', "Educational content", "Reading level and curriculum-friendly tags help teachers and homeschool parents plan with confidence."],
  ['<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z"/><path d="M9 12l2 2 4-4"/>', "A safe platform for kids", "No third-party ads, no unmoderated content, and every listing is age-tagged honestly."],
  ['<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>', "Excellent support", "A real, small team behind support@thegoodchildbookstore.com; no ticket numbers, no bots."],
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

function readTimeMinutes(content: string): number {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 200));
}

interface HomeBlogPost {
  slug: string;
  title: string;
  content: string;
  shortSummary: string | null;
  coverImageUrl: string | null;
  imageAltText: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  publishAt: Date | null;
  createdAt: Date;
  reads: number;
  comments: number;
  author: { name: string };
}

export default async function HomePage() {
  // Books restricted in the visitor's country are hidden from every list on
  // this page (best sellers, new arrivals, tile counts). The page is already
  // force-dynamic, so reading the request adds no cacheability cost.
  const visitorCountries = await getVisitorCountries();
  const realBooks = await getRealPublishedBooks(visitorCountries);
  // Shop by Category counts: live from the database, same visibility
  // rules as the lists above, older books attributed via their legacy genre.
  const seriesCounts = await getPublishedCategoryCounts(visitorCountries);
  const allBooksForArrivals = [...realBooks, ...BOOKS].sort((a, b) => (a.pubDate < b.pubDate ? 1 : -1));
  const newArrivals = getRotatingBatch(allBooksForArrivals, 12, 20 * 60 * 1000);
  // Live per-category/per-age counts — the same combined real+demo set
  // /bookshelf itself filters against, so the number on each card always
  // matches what clicking through to it actually shows, and grows the
  // moment a new book is published under that category.
  const catCounts = new Map<string, number>();
  const ageCounts = new Map<string, number>();
  for (const b of allBooksForArrivals) {
    catCounts.set(b.category, (catCounts.get(b.category) ?? 0) + 1);
    ageCounts.set(b.age, (ageCounts.get(b.age) ?? 0) + 1);
  }
  const AGE_EXPLORER = AGE_EXPLORER_BASE.map((a) => ({ ...a, count: ageCounts.get(a.range) ?? 0 }));
  const content = await getPagesContent();
  const hero = content.home;
  const platformStats = await getPlatformStats();
  let blogPosts: HomeBlogPost[] = [];
  try {
    // Bounded candidate set (newest 200 live posts) with an explicit
    // select — only the author's name, never the full User row.
    const result = await prisma.blog.findMany({
      where: { status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
      orderBy: { publishAt: "desc" },
      take: 200,
      select: {
        slug: true, title: true, content: true, shortSummary: true,
        coverImageUrl: true, imageAltText: true,
        authorFirstName: true, authorLastName: true,
        publishAt: true, createdAt: true,
        author: { select: { name: true } },
        _count: { select: { comments: true, reads: true } },
      },
    });
    if (Array.isArray(result)) {
      const candidates: HomeBlogPost[] = result.map((r) => ({
        slug: r.slug, title: r.title, content: r.content, shortSummary: r.shortSummary,
        coverImageUrl: r.coverImageUrl, imageAltText: r.imageAltText,
        authorFirstName: r.authorFirstName, authorLastName: r.authorLastName,
        publishAt: r.publishAt, createdAt: r.createdAt, author: r.author,
        reads: r._count.reads, comments: r._count.comments,
      }));
      blogPosts = selectHomeBlogs(candidates);
    }
  } catch {
    // Degrade to no preview section rather than a 500 if the database is
    // unreachable — the rest of the homepage should still render.
  }

  return (
    <main>
      <section style={{ paddingTop: "0.5in", paddingBottom: "calc(0.5in - 8mm)" }}>
        <div className="wrap">
          <HeroBannerCarousel
            heading={hero.heading === DEFAULT_PAGES_CONTENT.home.heading ? "Where young minds fall in love with reading." : hero.heading}
            lede={hero.lede}
            welcomeImage={hero.heroWelcomeImage}
            browseImage={hero.heroBrowseImage}
            authorImage={hero.heroAuthorImage}
            affiliateImage={hero.heroAffiliateImage}
          />
        </div>
      </section>

      <FadeInSection style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2 className="home-section-heading">Shop by Category</h2>
              <p>Eight series to explore, each one its own world of stories.</p>
            </div>
          </div>
          <div className="cat-grid cat-grid-8">
            {CATEGORIES.map((c) => (
              <Link key={c} href={`/bookshelf?series=${categorySlug(c)}`} className="cat-tile cat-tile-themed" style={categoryThemeStyle(c)}>
                <span>{c}</span>
                <small>{CATEGORY_BLURBS[c]}</small>
                <span className="cat-count">{bookCountLabel(seriesCounts[c])}</span>
              </Link>
            ))}
          </div>
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: "calc(0.5in - 8mm)" }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2 className="home-section-heading">Best Sellers</h2>
              <p>What families are reading right now.</p>
            </div>
          </div>
          <BestSellersCarousel extraBooks={realBooks} />
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: "calc(0.5in - 8mm)" }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2 className="home-section-heading">Shop by Shelf</h2>
              <p>Five ways into the story, sorted by age and mood.</p>
            </div>
          </div>
          <div className="cat-grid">
            {CATS.map((c, i) => (
              <Link key={c.id} href={`/bookshelf?cat=${c.id}`} className={`cat-tile ${["age-card-blue", "age-card-orange", "age-card-grey", "age-card-purple", "age-card-green"][i % 5]}`}>
                <span>{c.name}</span>
                <small>{c.blurb}</small>
                <span className="cat-count">{catCounts.get(c.id) ?? 0} books</span>
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
              <svg viewBox="0 0 24 24" fill="none" stroke="#3A2C62" strokeWidth={2}>
                <path d="M20 7h-9m0 10h9M4 7h1m-1 10h1m5-14v18" />
                <rect x={4} y={7} width={4} height={10} rx={1} />
              </svg>
            }
            title={hero.bookClubBannerTitle}
            body={hero.bookClubBannerBody}
            imageUrl={hero.bookClubBannerImage}
            ctaHref="/subscription"
            ctaLabel="See the plans"
          />
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: "calc(0.5in - 8mm)" }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2 className="home-section-heading">New Arrivals</h2>
              <p>Books that have just been published.</p>
            </div>
            <Link href="/bookshelf" className="see-all">See the full bookshelf →</Link>
          </div>
          <div className="book-grid-12">
            {newArrivals.map((b) => (
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
            imageUrl={hero.printBannerImage}
            ctaHref="/bookshelf?format=print"
            ctaLabel="Shop print copies"
          />
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: "calc(0.5in - 8mm)" }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2 className="home-section-heading">Why Families Choose Us</h2>
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

      {/* The stats band (books published / authors / readers / countries
          served) is hidden entirely — not just visually, but removed from
          the layout so Featured Authors moves up with no gap left behind
          — until every real, live launch threshold in
          lib/platform-stats.ts is simultaneously met. LiveRefresher below
          keeps `platformStats` current for every visitor, signed in or
          not, by re-running this Server Component's data fetch on an
          interval (see components/LiveRefresher.tsx) — once the
          thresholds are crossed, the band reclaims this spot on the very
          next refresh with no deploy needed. */}
      <LiveRefresher intervalMs={60000} />
      {platformStats.thresholdsMet && (
        <FadeInSection style={{ paddingTop: 0 }}>
          <div className="wrap">
            <StatsBand stats={platformStats} />
          </div>
        </FadeInSection>
      )}

      <FadeInSection style={{ paddingTop: "calc(0.5in - 8mm)" }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2 className="home-section-heading">Featured Authors</h2>
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
            imageUrl={hero.affiliateBannerImage}
            ctaHref="/signup/affiliate"
            ctaLabel="Become an affiliate"
          />
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: "calc(0.5in - 8mm)" }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2 className="home-section-heading">Shop by Age</h2>
              <p>Every title is age-tagged honestly, so you always know what you&apos;re handing over.</p>
            </div>
          </div>
          <div className="age-grid">
            {AGE_EXPLORER.map((a, i) => (
              <Link key={a.range} href={`/bookshelf?age=${a.range}`} className={`age-card ${["age-card-blue", "age-card-orange", "age-card-grey", "age-card-purple", "age-card-green"][i % 5]}`}>
                <div className="age-range">{a.range}</div>
                <div className="age-label">{a.label}</div>
                <div className="age-count">{a.count} books</div>
              </Link>
            ))}
          </div>
        </div>
      </FadeInSection>

      <FadeInSection style={{ paddingTop: "calc(0.5in - 8mm)" }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2 className="home-section-heading">Why Reading Matters</h2>
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
            imageUrl={hero.journalBannerImage}
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
                  <div key={p.slug} className="blog-card-v2">
                    <Link href={`/blog/${p.slug}`}>
                      <div className="blog-cover">
                        {p.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- real uploaded blog cover
                          <img src={p.coverImageUrl} alt={p.imageAltText || p.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block" }} />
                        ) : (
                          <svg className="motif" viewBox="0 0 100 100"><Motif kind={motif} color="#2E2442" /></svg>
                        )}
                        <span className="blog-cover-badge">{readTimeMinutes(p.content)} min read</span>
                      </div>
                    </Link>
                    <div className="blog-body">
                      <Link href={`/blog/${p.slug}`}><h3>{p.title}</h3></Link>
                      <p>{(p.shortSummary || p.content).slice(0, 120)}{(p.shortSummary || p.content).length > 120 ? "…" : ""}</p>
                      <div className="blog-meta">
                        <span>by {(p.authorFirstName || p.authorLastName) ? `${p.authorFirstName ?? ""} ${p.authorLastName ?? ""}`.trim() : p.author.name}</span>
                        <span>{(p.publishAt ?? p.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <Link className="blog-read-more" href={`/blog/${p.slug}`}>Read more →</Link>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <Link href="/blog" className="see-all">Read the journal →</Link>
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
