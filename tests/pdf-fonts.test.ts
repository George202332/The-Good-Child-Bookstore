import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { classifyFontName, embedMissingFonts, planFontFixes } from "../lib/pdf-fonts";
import { scanFonts } from "../lib/pdf-font-scan";
import { buildCoverWrapPdf, coverLayout } from "../lib/lulu-cover";

async function samplePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([396, 612]);
  page.drawText("Hello", { x: 40, y: 500, size: 18, font: await doc.embedFont(StandardFonts.Helvetica) });
  page.drawText("Title", { x: 40, y: 450, size: 24, font: await doc.embedFont(StandardFonts.TimesRomanBold) });
  doc.addPage([396, 612]);
  return doc.save();
}

test("font names are matched to a bundled stand-in", () => {
  assert.deepEqual(classifyFontName("Helvetica-Bold"), { match: "metric", family: "sans", bold: true, italic: false });
  assert.equal(classifyFontName("ArialMT").family, "sans");
  assert.equal(classifyFontName("TimesNewRomanPS-ItalicMT").italic, true);
  assert.equal(classifyFontName("CourierNewPSMT").family, "mono");
  assert.equal(classifyFontName("Arimo-Regular").match, "exact");
  assert.equal(classifyFontName("Calibri").match, "generic");
  assert.equal(classifyFontName("Wingdings-Regular").match, "none");
});

test("the plan says what is automatic, what needs approval and what cannot be done", () => {
  const plan = planFontFixes([
    { name: "Arimo", embedded: false, simple: true, subtype: "TrueType" },
    { name: "Helvetica", embedded: false, simple: true, subtype: "Type1" },
    { name: "Calibri", embedded: false, simple: true, subtype: "TrueType" },
    { name: "SomeCID", embedded: false, simple: false, subtype: "Type0" },
    { name: "Embedded", embedded: true, simple: true, subtype: "TrueType" },
  ]);
  const by = Object.fromEntries(plan.map((p) => [p.name, p]));
  assert.equal(by.Arimo.status, "auto");
  assert.equal(by.Helvetica.status, "needs-approval");
  assert.equal(by.Helvetica.sameWidths, true);
  assert.equal(by.Calibri.status, "needs-approval");
  assert.equal(by.Calibri.sameWidths, false);
  assert.equal(by.SomeCID.status, "unavailable");
  assert.equal(by.Embedded, undefined);
});

test("nothing is swapped without approval; with approval every font ends up embedded and the pages are unchanged", async () => {
  const original = await samplePdf();
  const copy = new Uint8Array(original);
  const none = await embedMissingFonts(original, []);
  assert.equal(none.embedded.length, 0);
  assert.deepEqual(none.remaining, ["Helvetica", "Times-Bold"]);

  const fixed = await embedMissingFonts(original, ["Helvetica", "Times-Bold"]);
  assert.deepEqual(fixed.remaining, []);
  assert.equal(fixed.embedded.length, 2);
  const doc = await PDFDocument.load(fixed.bytes);
  assert.equal(doc.getPageCount(), 2);
  assert.ok((await scanFonts(doc)).every((f) => f.embedded));
  assert.deepEqual(original, copy, "the input bytes are never modified");
});

test("a generated cover wrap has every font embedded, including the spine title", async () => {
  const img = await sharp({ create: { width: 600, height: 900, channels: 3, background: { r: 200, g: 120, b: 80 } } }).png().toBuffer();
  const layout = coverLayout(12.6 * 72, 9.25 * 72, 6, 9);
  assert.ok(layout && layout.spine >= 22);
  const pdf = await buildCoverWrapPdf({ layout: layout!, frontImage: img, title: "The Good Child", author: "A. Writer" });
  const doc = await PDFDocument.load(pdf);
  const fonts = await scanFonts(doc);
  assert.ok(fonts.length > 0, "the spine title uses a font");
  assert.ok(fonts.every((f) => f.embedded));
});
