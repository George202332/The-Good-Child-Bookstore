import { test } from "node:test";
import assert from "node:assert/strict";
import { coverGuides, coverTemplatePdf, pdfSafeText } from "../lib/cover-specs";
import { PDFDocument } from "pdf-lib";

const paperback = { format: "paperback" as const, widthIn: 12.375, heightIn: 9.25, spineIn: 0.125, trimWIn: 6, trimHIn: 9 };
const hardcover = { format: "hardcover" as const, widthIn: 13.75, heightIn: 10.625, spineIn: 0.25, trimWIn: 6, trimHIn: 9 };

test("paperback: the outer margin is the 0.125 in bleed, no wrap", () => {
  const g = coverGuides(paperback);
  assert.equal(g.outerIn, 0.125);
  assert.equal(g.bleedIn, 0.125);
  assert.equal(g.wrapIn, 0);
});

test("hardcover: the extra beyond the bleed is the wrap", () => {
  const g = coverGuides(hardcover);
  assert.equal(g.outerIn, 0.813);
  assert.equal(g.wrapIn, 0.688);
});

test("the template is one PDF page sized exactly to the full wrap", async () => {
  for (const spec of [paperback, hardcover]) {
    const bytes = await coverTemplatePdf(coverGuides(spec), { title: "My Book \u2014 \u4e2d", trimLabel: "6 x 9 in", pageCount: 120 });
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 1);
    const { width, height } = doc.getPage(0).getSize();
    assert.ok(Math.abs(width - spec.widthIn * 72) < 0.01);
    assert.ok(Math.abs(height - spec.heightIn * 72) < 0.01);
  }
});

test("text the PDF fonts cannot show becomes a question mark", () => {
  assert.equal(pdfSafeText("Caf\u00e9 \u4e2d"), "Caf\u00e9 ?");
});
