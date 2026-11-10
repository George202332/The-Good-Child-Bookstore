import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPINE_EDGE_GAP_MM } from "../lib/spine-text";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("spine gaps are 5 mm", () => assert.equal(SPINE_EDGE_GAP_MM, 5));
test("description editor is 252px", () => assert.match(read("app/site.css"), /\.description-editable\{[^}]*min-height:\s*252px[^}]*max-height:\s*252px/));
test("pricing pop-ups per edition", () => {
  const f = read("app/account/books/new/PrintSubmissionForm.tsx");
  assert.match(f, /<PrintingCostNote label="Paperback"/);
  assert.match(f, /<PrintingCostNote label="Hardcover"/);
});
test("live SEO score pieces", () => {
  const s = read("components/BookSeoAdvice.tsx");
  assert.match(s, /SETTLE_MS/); assert.match(s, /seo-gain/);
  assert.match(read("app/account/books/MyBooksTable.tsx"), /mb-seo/);
});
test("instant click feedback", () => {
  assert.match(read("app/account/layout.tsx"), /NavProgress/);
  assert.ok(read("app/account/loading.tsx").length > 0);
});
test("saved and draft artwork shelves", () => {
  const a = read("actions/print-mockups.ts");
  assert.match(a, /savedPrintMockup/); assert.match(a, /print_mockups_draft:/);
});
test("publishing restyle: step strip and sticky bar", () => {
  assert.match(read("app/account/books/new/EbookSubmissionForm.tsx"), /<StepStrip \/>/);
  assert.match(read("app/account/books/new/PrintSubmissionForm.tsx"), /<StepStrip \/>/);
  assert.match(read("app/account/books/new/PublishPanel.tsx"), /StickyActionBar/);
  const css = read("app/site.css");
  assert.match(css, /safe-area-inset-bottom/); assert.match(css, /\.step-strip/);
});
