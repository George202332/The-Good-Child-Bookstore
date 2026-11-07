import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planSpineText } from "../lib/spine-text";
import { layoutBackDescription, backWordsOver, BACK_DESCRIPTION_MAX_WORDS } from "../lib/back-cover";
import { buildCoverWrapPdf, coverLayout } from "../lib/lulu-cover";

const width = (t: string, s: number) => t.length * s * 0.5;

test("spine: author at the top end, title lower toward the bottom end, nothing crowded at the top", () => {
  const plan = planSpineText({ spine: 0.7 * 72, length: 612, unitsPerInch: 72, title: "The Friend", author: "Liam Walker", width })!;
  const [author, title] = plan.lines;
  assert.equal(author.start, 0.5 * 72);
  const titleEnd = title.start + width(title.text, title.size);
  assert.ok(Math.abs(titleEnd - (612 - 0.5 * 72)) < 0.01, "the title ends at the bottom margin");
  assert.ok(title.start > author.start + width(author.text, author.size) + 100, "a clear gap between the two");
});

test("back cover: justified lines fill the width exactly and never pass the margins", () => {
  const text = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
  const lay = layoutBackDescription({ text, boxW: 200, boxH: 400, unitsPerInch: 72, width });
  assert.ok(lay.lines.length > 2);
  lay.lines.slice(0, -1).forEach((l) => {
    const last = l.words[l.words.length - 1];
    assert.ok(Math.abs(last.x + width(last.text, lay.size) - 200) < 0.01);
    assert.ok(l.words.every((w) => w.x >= 0));
  });
  assert.ok(lay.size >= 0.1265 * 72 * 0.88 - 1e-9 && lay.size <= 0.1265 * 72 + 1e-9);
});

test("back cover: about 170 words, counted, with the words over reported; text is cut rather than overflow", () => {
  const long = Array.from({ length: 250 }, (_, i) => `w${i}`).join(" ");
  assert.equal(BACK_DESCRIPTION_MAX_WORDS, 170);
  assert.equal(backWordsOver(long), 80);
  assert.equal(backWordsOver("a few words"), 0);
  const lay = layoutBackDescription({ text: long, boxW: 150, boxH: 120, unitsPerInch: 72, width });
  assert.equal(lay.truncated, true);
  assert.ok(lay.lines.length * lay.lineHeight <= 120 + 1e-9);
});

test("the cover file Lulu receives has the description on its back and embeds its fonts", async () => {
  const sharp = (await import("sharp")).default;
  const img = await sharp({ create: { width: 600, height: 900, channels: 3, background: "#3366aa" } }).png().toBuffer();
  const layout = coverLayout((5.5 * 2 + 0.6 + 0.25) * 72, (8.5 + 0.25) * 72, 5.5, 8.5)!;
  const pdf = await buildCoverWrapPdf({ layout, frontImage: img, title: "The Friend", author: "Liam Walker", description: "A story about a friend. ".repeat(20) });
  assert.ok(pdf.length > 1000);
});

test("a regenerated cover never changes a file already sent to Lulu: covers are only ever created, never updated", () => {
  const src = readFileSync("lib/payments/lulu.ts", "utf8");
  assert.ok(!/uploadedFile\.(update|upsert|delete)/.test(src), "no code path rewrites a stored cover file");
  assert.match(src, /uploadedFile\.create/);
});

test("price form: the red lines and the ISBN/affiliate/promotion controls are gone", () => {
  const form = readFileSync("app/account/books/new/PrintSubmissionForm.tsx", "utf8");
  for (const gone of ["Price too low", "Publishing is blocked until this is fixed", "Promotional Campaign Eligible", "Affiliate Eligible", "Copy that setting here", "ISBN Barcode", "p-isbn"]) {
    assert.ok(!form.includes(gone), gone);
  }
  assert.match(form, /Minimum price for this edition/);
  assert.match(form, /All published books are available to affiliates\./);
  assert.match(form, /Private Printing \(Author Copies Only\)/);
});
