import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planSpineText, SPINE_TEXT_MIN_PAGES } from "../lib/spine-text";
import { bookSeoScore, BOOK_SEO_WORTH } from "../lib/seo/book-seo-score";
import { trimOutline } from "../components/SpecPicture";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const width = (t: string, s: number) => t.length * s * 0.5;

test("spine writing needs 100 pages (Lulu's own rule) and a spine wide enough", () => {
  assert.equal(SPINE_TEXT_MIN_PAGES, 100);
  const base = { spine: 0.3 * 72, length: 612, unitsPerInch: 72, title: "The Friend", author: "Liam Walker", width };
  assert.equal(planSpineText({ ...base, pages: 99 }), null);
  assert.ok(planSpineText({ ...base, pages: 100 }));
  assert.ok(planSpineText(base), "without a page count only the width rule applies");
});

test("the three places that draw a spine all pass the page count", () => {
  for (const f of ["lib/lulu-cover.ts", "lib/mockup/wrap.ts", "lib/mockup/render.ts", "components/CoverWrapPreview.tsx"]) assert.match(src(f), /pages(: [a-z.]+)?,/, f);
  assert.match(src("lib/payments/lulu.ts"), /pages: opts\.pageCount/);
});

test("sent-file guard: a cover already made for an order Lulu received is reused, never rebuilt", () => {
  const l = src("lib/payments/lulu.ts");
  assert.match(l, /SENT-FILE GUARD/);
  assert.match(l, /printJobStatus === "SUBMITTED"/);
});

test("SEO score: weights add up to 100, every element has points and a tip, and the panel lists them all", () => {
  assert.equal(Object.values(BOOK_SEO_WORTH).reduce((a, b) => a + b, 0), 100);
  const r = bookSeoScore({ title: "Tembo", descriptionText: "A story.", hasCover: false });
  assert.equal(r.checks.length, Object.keys(BOOK_SEO_WORTH).length);
  assert.equal(r.score, r.checks.reduce((n, c) => n + c.earned, 0));
  for (const c of r.checks) assert.ok(c.worth > 0 && c.what && c.advice);
  const panel = src("components/BookSeoAdvice.tsx");
  for (const t of ["Top Improvements", "Biggest Possible Gain", "does not guarantee any ranking"]) assert.ok(panel.includes(t), t);
});

test("trim outlines share one scale so sizes compare", () => {
  const a = trimOutline("0500X0800"), b = trimOutline("0850X1100");
  assert.ok(b.w > a.w && b.h > a.h);
  assert.ok(b.h <= 58);
});

test("dashboard cards: one watcher flashes each card whose own number changed", () => {
  const w = src("components/LiveCardFlash.tsx");
  assert.match(w, /before\.label !== label \|\| before\.value === value/);
  assert.match(src("components/DashboardShell.tsx"), /<LiveCardFlash \/>/);
  assert.doesNotMatch(src("components/AdminShell.tsx"), /LiveCardFlash/);
  for (const p of ["revenue", "referrals", "active-campaigns", "performance"]) assert.match(src(`app/account/${p}/page.tsx`), /<LiveRefresher \/>/, p);
});

test("tables: refined look scoped to the accounts, admin untouched; affiliate line gone; cost panel and pictures present", () => {
  const css = src("app/site.css");
  assert.match(css, /\.dashboard-content table:not\(\.mybooks-table\)/);
  assert.ok(!/\.admin-content table:not/.test(css));
  assert.doesNotMatch(src("app/account/books/new/EbookSubmissionForm.tsx"), /available to affiliates/);
  assert.match(src("app/account/books/new/PrintingCostNote.tsx"), /How This Cost Is Worked Out/);
  assert.match(src("app/account/books/new/PrintSubmissionForm.tsx"), /picture=\{\(c\) => <SpecPicture kind="foil"/);
});
