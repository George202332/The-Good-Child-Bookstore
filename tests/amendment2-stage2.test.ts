import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planSpineText } from "../lib/spine-text";
import { layoutBackDescription, backWordsOver, BACK_DESCRIPTION_MAX_WORDS } from "../lib/back-cover";
import { buildCoverWrapPdf, coverLayout } from "../lib/lulu-cover";

const width = (t: string, s: number) => t.length * s * 0.5;

test("spine: author 5 mm from the top edge, title's last letter 5 mm from the bottom edge, same letter size as before", () => {
  const plan = planSpineText({ spine: 0.7 * 72, length: 612, unitsPerInch: 72, title: "The Friend", author: "Liam Walker", width })!;
  const [author, title] = plan.lines;
  const mm2 = (5 / 25.4) * 72;
  assert.ok(Math.abs(author.start - mm2) < 1e-9, "the author's first letter is 5 mm from the top");
  const titleEnd = title.start + width(title.text, title.size);
  assert.ok(Math.abs(titleEnd - (612 - mm2)) < 1e-9, "the title's last letter is 5 mm from the bottom");
  assert.ok(Math.abs(title.size - Math.min(0.2 * 72, 0.7 * 72 * 0.5)) < 1e-9, "letter size unchanged");
  assert.equal(plan.shrink, 1);
  assert.equal(plan.notice, null);
});

test("spine: a long title shrinks slightly, then is shortened with a notice; nothing passes the 5 mm gaps; very thick and very thin spines", () => {
  const mm2 = (5 / 25.4) * 72;
  const slightly = planSpineText({ spine: 0.7 * 72, length: 240, unitsPerInch: 72, title: "A Fairly Long Title Here", author: "Liam Walker", width })!;
  assert.ok(slightly.shrink < 1 && slightly.shrink >= 0.7 && !slightly.truncated);
  assert.match(slightly.notice ?? "", /smaller/);
  const very = planSpineText({ spine: 0.7 * 72, length: 300, unitsPerInch: 72, title: "A".repeat(200), author: "Liam Walker", width })!;
  assert.ok(very.truncated && /shortened/.test(very.notice ?? ""));
  for (const p of [slightly, very]) for (const l of p.lines) {
    assert.ok(l.start >= mm2 - 1e-9);
    assert.ok(l.start + width(l.text, l.size) <= (p === very ? 300 : 240) - mm2 + 1e-9);
  }
  const thick = planSpineText({ spine: 3 * 72, length: 612, unitsPerInch: 72, title: "The Friend", author: "Liam Walker", width })!;
  assert.ok(Math.abs(thick.lines[1].size - 0.2 * 72) < 1e-9, "a very thick spine keeps the same letter size, never larger");
  assert.equal(planSpineText({ spine: 0.2 * 72, length: 612, unitsPerInch: 72, title: "The Friend", author: "Liam Walker", width }), null);
});

test("back cover: lines are left-aligned (ragged right), start at the left margin, never pass the right margin; 11 points, down to 10", () => {
  const text = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
  const lay = layoutBackDescription({ text, boxW: 200, boxH: 400, unitsPerInch: 72, width });
  assert.ok(lay.lines.length > 2);
  const ends = lay.lines.slice(0, -1).map((l) => { const last = l.words[l.words.length - 1]; return last.x + width(last.text, lay.size); });
  assert.ok(ends.every((e) => e <= 200 + 1e-9), "never past the right margin");
  assert.ok(new Set(ends.map((e) => Math.round(e))).size > 1, "ragged, not justified");
  lay.lines.forEach((l) => {
    assert.equal(l.words[0].x, 0);
    l.words.slice(1).forEach((w, i) => assert.ok(Math.abs(w.x - (l.words[i].x + width(l.words[i].text, lay.size) + width(" ", lay.size))) < 1e-9, "normal word spacing"));
  });
  assert.ok(Math.abs(lay.size - 11) < 1e-9, "11 points");
  const tight = layoutBackDescription({ text, boxW: 200, boxH: 330, unitsPerInch: 72, width });
  assert.ok(tight.size >= 10 - 1e-9 && tight.size <= 11 + 1e-9);
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
  assert.doesNotMatch(form, /All published books are available to affiliates/);
  assert.match(form, /Private Printing \(Author Copies Only\)/);
});
