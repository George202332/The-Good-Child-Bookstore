import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isIndexableDeployment } from "../lib/seo/indexing";
import { bookMeta, bookMetaTitle, bookMetaDescription, isThinBook, TITLE_MAX, DESCRIPTION_MAX } from "../lib/seo/book-meta";
import { allTopics, bookMatchesTopic, findTopic, topicPath } from "../lib/seo/topics";
import { clip, slugify } from "../lib/seo/text";
import { parseBlocks, tocOf, linkCounts, readTimeMinutes, safeHref, plainText, firstParagraph } from "../lib/blog/content";
import { parseKeywords, serializeKeywords } from "../lib/blog/keywords";
import { blogSeoScore, keywordDensityPercent } from "../lib/blog/seo-score";
import { relatedBooksForPost, relatedPosts } from "../lib/blog/related";
import { bookSeoScore } from "../lib/seo/book-seo-score";
import { chunk } from "../lib/seo/sitemap-data-pure";
import { organizationJsonLd, websiteJsonLd, faqJsonLd, itemListJsonLd } from "../lib/seo/json-ld";

const root = join(__dirname, "..");
const src = (p: string) => readFileSync(join(root, p), "utf8");

test("only the live site is indexable", () => {
  assert.equal(isIndexableDeployment("production"), true);
  for (const e of ["preview", "development", undefined, ""]) assert.equal(isIndexableDeployment(e as string | undefined), false);
  assert.match(src("app/robots.ts"), /disallow: "\/"/);
  assert.match(src("next.config.ts"), /X-Robots-Tag/);
  assert.match(src("app/layout.tsx"), /isIndexableDeployment\(\)/);
});

test("no page carries a hard-coded production address or an inherited canonical", () => {
  const layout = src("app/layout.tsx");
  assert.doesNotMatch(layout, /thegoodchildbookstore\.com/);
  assert.doesNotMatch(layout, /canonical:/);
  assert.doesNotMatch(src("app/[slug]/page.tsx"), /thegoodchildbookstore\.com/);
  for (const p of ["app/page.tsx", "app/about/page.tsx", "app/bookshelf/page.tsx", "app/blog/page.tsx", "app/faq/page.tsx", "app/contact/page.tsx"]) assert.match(src(p), /pageMeta\(/, p);
});

const tembo = { title: "Tembo the Brave Little Elephant", author: "Amina Otieno", genre: "Picture Books", category: "Adventure Series", subcategory: "Jungle and Safari", age: "3-5", formats: ["eBook", "Paperback"], blurb: "Tembo is afraid of the dark until a firefly teaches him that even the smallest light can lead the whole herd home.", hasCover: true };

test("book titles and descriptions come from the book's own data, within length, and differ per book", () => {
  const m = bookMeta(tembo);
  assert.ok(m.title.length <= TITLE_MAX && m.title.includes("Tembo") && m.title.includes("Amina Otieno"));
  assert.ok(m.description.length <= DESCRIPTION_MAX && m.description.includes("jungle and safari") && m.description.includes("ages 3-5"));
  const other = bookMeta({ ...tembo, title: "Zuri and the Moon", author: "Kofi Mensah", subcategory: "Bedtime Routines", genre: "Bedtime Stories" });
  assert.notEqual(other.title, m.title);
  assert.notEqual(other.description, m.description);
  assert.equal(m.thin, false);
  const longTitle = bookMetaTitle({ ...tembo, title: "A".repeat(80) });
  assert.ok(longTitle.length <= TITLE_MAX, "an over-long title is clipped");
});

test("a book with no real description and no cover is thin and asks for no-index; its text still names the title and author", () => {
  const thin = { title: "X", author: "Y Z", blurb: "", hasCover: false };
  assert.equal(isThinBook(thin), true);
  assert.equal(isThinBook({ ...thin, hasCover: true }), false);
  assert.match(bookMetaDescription(thin), /X.*Y Z/);
  assert.match(src("app/[slug]/page.tsx"), /noindex: meta\.thin/);
});

test("topic pages: every category, subcategory, genre and age group has one address", () => {
  const t = allTopics();
  assert.ok(t.length > 50);
  const keys = new Set(t.map((x) => `${x.kind}/${x.slug}`));
  assert.equal(keys.size, t.length, "no two topics share an address");
  const cat = findTopic("category", "adventure-series")!;
  assert.equal(topicPath(cat), "/browse/category/adventure-series");
  assert.equal(bookMatchesTopic({ series: "Adventure Series" }, cat), true);
  assert.equal(bookMatchesTopic({ series: "Fun and Humor" }, cat), false);
  assert.equal(bookMatchesTopic({ ages: ["6-8", "9-12"] }, findTopic("age", "9-12")!), true);
  assert.equal(findTopic("category", "nope"), undefined);
});

test("blog text: headings, lists, links, table of contents and counts", () => {
  const post = "Bedtime stories help toddlers sleep. Read [our picture books](/browse/genre/picture-books) tonight.\n\n## Why bedtime stories work\n\nShort sentences help. See [a study](https://example.org/study) too.\n\n### A calm routine\n\n- Dim the lights\n- Read aloud\n\n# Last words\n\n> Read together.\n\n1. One\n2. Two";
  const b = parseBlocks(post);
  assert.deepEqual(tocOf(b).map((t) => [t.level, t.text]), [[2, "Why bedtime stories work"], [3, "A calm routine"], [2, "Last words"]]);
  assert.equal(b.some((x) => x.type === "ul"), true);
  assert.equal(b.some((x) => x.type === "quote"), true);
  assert.equal(b.some((x) => x.type === "ol"), true);
  assert.deepEqual(linkCounts(post, "example.com"), { internal: 1, external: 1 });
  assert.equal(linkCounts("[home](https://www.example.com/x)", "example.com").internal, 1);
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("//evil.example"), null);
  assert.equal(parseBlocks("[x](javascript:alert(1))")[0].type, "p");
  assert.match(firstParagraph(post), /^Bedtime stories help/);
  assert.ok(readTimeMinutes("word ".repeat(400)) === 2);
  assert.doesNotMatch(plainText(post), /\]\(|##/);
});

test("duplicate heading ids stay unique", () => {
  const ids = tocOf(parseBlocks("## Tips\n\ntext\n\n## Tips\n\ntext")).map((t) => t.id);
  assert.deepEqual(ids, ["tips", "tips-2"]);
});

test("focus and related keywords live in the existing seoKeywords field", () => {
  assert.deepEqual(parseKeywords("bedtime stories, toddlers, sleep"), { focus: "bedtime stories", related: ["toddlers", "sleep"] });
  assert.equal(serializeKeywords("Bedtime stories", ["toddlers", "bedtime stories", "sleep, tips"]), "Bedtime stories, toddlers, sleep tips");
  assert.deepEqual(parseKeywords(null), { focus: "", related: [] });
});

test("the blog SEO score checks each thing asked for and gives plain advice", () => {
  const good = blogSeoScore({
    title: "Bedtime stories for toddlers: a calm routine", slug: "bedtime-stories-for-toddlers",
    content: ("Bedtime stories for toddlers can turn a hard evening into a calm one. See [our picture books](/browse/genre/picture-books). " + "Read slowly. Keep the lights low. Let your child pick the book. ".repeat(40) + "\n\n## Why bedtime stories for toddlers work\n\nThey build a routine. A [study](https://example.org/s) agrees.\n\n## Picking a book\n\nChoose short ones."),
    metaTitle: "Bedtime Stories for Toddlers: A Calm Routine", metaDescription: "Bedtime stories for toddlers can make evenings calmer. Learn how to build a routine and pick the right picture books to read aloud together.",
    imageAlt: "A toddler listening to bedtime stories", hasImage: true, focus: "bedtime stories for toddlers", siteHost: "example.com",
  });
  assert.ok(good.score >= 80, `score ${good.score}`);
  const bad = blogSeoScore({ title: "Hello", slug: "hello", content: "Short post.", focus: "", hasImage: false });
  assert.ok(bad.score < 40);
  assert.ok(bad.checks.some((c) => c.id === "focus" && c.level === "bad" && /focus keyword/i.test(c.advice)));
  assert.ok(bad.checks.some((c) => c.id === "internal" && c.level === "bad"));
  const stuffed = "bedtime stories ".repeat(60);
  assert.ok(keywordDensityPercent(stuffed, "bedtime stories") > 3);
  assert.ok(blogSeoScore({ title: "t", slug: "t", content: stuffed, focus: "bedtime stories" }).checks.find((c) => c.id === "kw-density")!.level === "bad");
});

test("posts and books are linked both ways from their own topics and words", () => {
  const post = { slug: "p", title: "Bedtime stories for toddlers", content: "We love Tembo the Brave Little Elephant.", tags: ["bedtime"], categories: ["Reading Tips"], seoKeywords: "bedtime stories" };
  const books = [
    { id: "1", title: "Tembo the Brave Little Elephant", slug: "tembo", author: "Amina Otieno", series: "Adventure Series" },
    { id: "2", title: "Zebra Maths", slug: "zebra", author: "Kofi Mensah", series: "Education Series" },
    { id: "3", title: "Sleepy Bedtime Stories", slug: "sleepy", author: "Lena Ruiz", genre: "Bedtime Stories" },
  ];
  const r = relatedBooksForPost(post, books);
  assert.deepEqual(r.map((b) => b.id), ["1", "3"], "the named book first, then the topic match; nothing unrelated");
  assert.deepEqual(relatedBooksForPost({ ...post, title: "Gardening", content: "", tags: [], categories: [], seoKeywords: "" }, books), []);
  const others = [{ slug: "a", title: "A", tags: ["bedtime"], categories: [], at: "2026-01-02" }, { slug: "b", title: "B", tags: ["maths"], categories: [], at: "2026-01-03" }, { slug: "p", title: "self", tags: ["bedtime"], categories: [] }];
  assert.deepEqual(relatedPosts(post, others).map((o) => o.slug), ["a"]);
});

test("the author's book SEO score gives plain advice and never blocks", () => {
  const thin = bookSeoScore({ title: "Tembo", descriptionText: "A story.", hasCover: false });
  assert.ok(thin.score < 40);
  assert.ok(thin.checks.some((c) => /longer description/i.test(c.advice)));
  const full = bookSeoScore({ title: "Tembo", subtitle: "A brave elephant", descriptionText: "Tembo is a brave little elephant who is afraid of the dark. " + "He meets a firefly and learns that small lights lead the way home. ".repeat(8), hasCover: true, category: "Adventure Series", subcategory: "Jungle and Safari", genre: "Picture Books", ageGroup: "3-5 years" });
  assert.ok(full.score >= 90, `score ${full.score}`);
  assert.doesNotMatch(src("components/BookSeoAdvice.tsx"), /disabled/);
});

test("structured data: organisation, site search, FAQ only when real, lists", () => {
  assert.equal(organizationJsonLd()["@type"], "Organization");
  assert.match(JSON.stringify(websiteJsonLd()), /SearchAction[\s\S]*bookshelf\?q=\{search_term_string\}/);
  assert.equal(faqJsonLd([]), null);
  assert.equal(faqJsonLd([{ question: " ", answer: "x" }]), null);
  assert.equal(faqJsonLd([{ question: "Q?", answer: "A." }])!["@type"], "FAQPage");
  assert.equal(itemListJsonLd("x", [{ name: "a", url: "u" }]).numberOfItems, 1);
  const ld = src("lib/seo/json-ld.ts");
  assert.match(ld, /reviewCount && input\.reviewCount > 0/, "no rating is shown when there are no reviews");
});

test("sitemaps are split into files and staging advertises nothing", () => {
  assert.equal(chunk(Array.from({ length: 2500 }, (_, i) => i), 1000).length, 3);
  assert.equal(chunk([], 1000).length, 1);
  assert.match(src("app/sitemap.xml/route.ts"), /buildSitemapIndexXml\(\[\]\)/);
  assert.match(src("app/sitemap-books.xml/route.ts"), /searchParams\.get\("page"\)/);
});

test("text helpers", () => {
  assert.equal(clip("one two three four five six seven", 15), "one two three…");
  assert.equal(clip("short", 20), "short");
  assert.equal(slugify("Fun & Games, Today!"), "fun-and-games-today");
});
