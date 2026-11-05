import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyticsEnabledFor, classifySource, isBookPath, isPrivatePath, parseConsent, sanitizeEvent } from "../lib/analytics/policy";
import { parseMonth, reportToCsv } from "../lib/analytics/report-format";
import { readFileSync } from "node:fs";

describe("analytics policy", () => {
  it("is on only for the live site", () => {
    assert.equal(analyticsEnabledFor("production"), true);
    for (const v of ["preview", "development", undefined, ""]) assert.equal(analyticsEnabledFor(v), false);
  });
  it("treats private areas as private", () => {
    for (const p of ["/admin", "/admin/books", "/checkout", "/checkout/confirmation", "/account/library", "/library", "/cart", "/login"]) assert.equal(isPrivatePath(p), true);
    for (const p of ["/", "/blog/hello", "/bookshelf", "/my-book", "/accounting-for-kids"]) assert.equal(isPrivatePath(p), false);
  });
  it("is off until accepted", () => {
    assert.equal(parseConsent(undefined), "unset");
    assert.equal(parseConsent("a=b; gcb_consent=denied"), "denied");
    assert.equal(parseConsent("gcb_consent=granted"), "granted");
    assert.equal(parseConsent("gcb_consent=maybe"), "unset");
  });
  it("recognises book links", () => {
    assert.equal(isBookPath("/the-moon-song"), true);
    assert.equal(isBookPath("/book/abc123"), true);
    assert.equal(isBookPath("/blog/some-post"), false);
    assert.equal(isBookPath("/bookshelf"), false);
    assert.equal(isBookPath("/browse/category/animals"), false);
  });
  it("classifies sources without keeping addresses", () => {
    assert.equal(classifySource("", "shop.com"), "Direct");
    assert.equal(classifySource("www.google.com", "shop.com"), "Search");
    assert.equal(classifySource("l.facebook.com", "shop.com"), "Social");
    assert.equal(classifySource("shop.com", "shop.com"), "Direct");
    assert.equal(classifySource("blog.example.org", "shop.com"), "Other websites");
    assert.equal(classifySource("", "shop.com", "email"), "Email");
  });
  it("keeps only allowed short fields and never private page views", () => {
    const e = sanitizeEvent({ name: "add_to_cart", data: { bookId: "b1", format: "ebook", email: "a@b.com", name: "Ann" } });
    assert.deepEqual(e?.data, { bookId: "b1", format: "ebook" });
    assert.equal(sanitizeEvent({ name: "page_view", data: { path: "/checkout" } }), null);
    assert.notEqual(sanitizeEvent({ name: "page_view", data: { path: "/blog/x" } }), null);
    assert.equal(sanitizeEvent({ name: "hack", data: {} }), null);
    assert.equal(sanitizeEvent({ name: "purchase", data: {} }), null);
  });
});

describe("report helpers", () => {
  it("builds a month in Nairobi time and a safe CSV", () => {
    const m = parseMonth("2026-10");
    assert.equal(m.start.toISOString(), "2026-09-30T21:00:00.000Z");
    assert.equal(m.end.toISOString(), "2026-10-31T21:00:00.000Z");
    assert.match(parseMonth("junk").key, /^\d{4}-\d{2}$/);
    const csv = reportToCsv({ month: "2026-10", monthLabel: "October 2026", hasData: true, totals: { pageViews: 1, visits: 1, bookViews: 0, addToCart: 0, checkoutStarted: 0, purchases: 0, revenue: null }, topPages: [], topBlogPosts: [{ slug: "x", title: "=SUM(1)", views: 2 }], topBooks: [], sources: [], blogConversion: [] });
    assert.ok(csv.includes("'=SUM(1)"));
    assert.ok(!csv.includes("Revenue"));
  });
});

describe("wiring (source checks)", () => {
  const read = (p: string) => readFileSync(p, "utf8");
  it("layout decides Google loading from the deployment, not from the ids", () => {
    const s = read("app/layout.tsx");
    assert.ok(s.includes("analyticsEnabledFor()"));
    assert.doesNotMatch(s, /googletagmanager/);
  });
  it("the event receiver is live-only and needs consent", () => {
    const s = read("app/api/analytics/event/route.ts");
    assert.ok(s.includes("analyticsEnabledFor()"));
    assert.ok(s.includes('"granted"'));
  });
});
