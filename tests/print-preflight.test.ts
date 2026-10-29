import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { checkCoverSize, checkPageCount, checkPageSizes, inspectPdf, runInteriorChecks, pageLimitsForBinding } from "../lib/print-preflight";

async function pdfWithStandardFont(pages: number, w = 396, h = 612): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica); // NOT embedded in the file
  for (let i = 0; i < pages; i++) doc.addPage([w, h]).drawText("Hello", { x: 20, y: 20, font });
  return doc.save();
}

/** A page whose font dictionary points at an embedded font program (FontFile2). */
async function pdfWithEmbeddedFont(pages: number, w: number, h: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const ctx = doc.context;
  const fontFile = ctx.stream(new Uint8Array([0, 1, 2, 3]));
  const fontFileRef = ctx.register(fontFile);
  const descriptor = ctx.obj({ Type: "FontDescriptor", FontName: "ABCDEF+Fake", Flags: 32, FontFile2: fontFileRef });
  const descRef = ctx.register(descriptor);
  const font = ctx.obj({ Type: "Font", Subtype: "TrueType", BaseFont: "ABCDEF+Fake", FontDescriptor: descRef });
  const fontRef = ctx.register(font);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([w, h]);
    page.node.set(PDFName.of("Resources"), ctx.obj({ Font: { F1: fontRef } }));
  }
  return doc.save();
}

test("a PDF that uses a non-embedded font is flagged with the font name", async () => {
  const info = await inspectPdf(await pdfWithStandardFont(2));
  assert.deepEqual(info.unembeddedFonts, ["Helvetica"]);
  const r = await runInteriorChecks(await pdfWithStandardFont(40, 396, 612), { trimCode: "0550X0850", bindingCodes: ["PB"] });
  assert.ok(r.issues.some((i) => i.code === "FONTS" && /embedded/.test(i.message) && /Re-export/.test(i.fix)));
});

test("a PDF whose fonts are embedded passes the font check", async () => {
  const info = await inspectPdf(await pdfWithEmbeddedFont(2, 396, 612));
  assert.deepEqual(info.unembeddedFonts, []);
  assert.equal(info.pageCount, 2);
});

test("a damaged or non-PDF file is reported as unreadable", async () => {
  const r = await runInteriorChecks(new Uint8Array([1, 2, 3, 4]), { trimCode: "0550X0850", bindingCodes: ["PB"] });
  assert.equal(r.issues[0].code, "UNREADABLE");
});

test("page size must match the chosen trim size (exact or with bleed)", () => {
  const p55x85 = [{ widthIn: 5.5, heightIn: 8.5 }];
  assert.equal(checkPageSizes(p55x85, "0550X0850"), null);
  assert.equal(checkPageSizes([{ widthIn: 5.625, heightIn: 8.75 }], "0550X0850"), null); // with bleed
  const wrong = checkPageSizes(p55x85, "0600X0900");
  assert.equal(wrong?.code, "PAGE_SIZE");
  assert.match(wrong!.message, /5\.5 x 8\.5 in/);
  assert.equal(checkPageSizes([{ widthIn: 4, heightIn: 4 }], "0550X0850")?.code, "PAGE_SIZE");
  const mixed = checkPageSizes([...p55x85, { widthIn: 6, heightIn: 9 }], "0550X0850");
  assert.match(mixed!.message, /Page 2/);
});

test("page count must suit the binding", () => {
  assert.equal(checkPageCount(40, "PB"), null);
  assert.match(checkPageCount(20, "PB")!.message, /at least 32/);
  assert.match(checkPageCount(20, "LW")!.message, /at least 24/);
  assert.equal(checkPageCount(24, "LW"), null);
});

test("hardcover and coil limits", () => {
  assert.deepEqual(pageLimitsForBinding("LW"), { min: 24, max: 800 });
  assert.equal(pageLimitsForBinding("CO").max, 275);
  assert.equal(checkPageCount(900, "PB")?.code, "PAGE_COUNT");
});

test("cover size must match the cover specification", () => {
  assert.equal(checkCoverSize({ widthPt: 900, heightPt: 700 }, { widthPt: 901, heightPt: 700 }), null);
  const bad = checkCoverSize({ widthPt: 800, heightPt: 700 }, { widthPt: 901, heightPt: 700 });
  assert.equal(bad?.code, "COVER_SIZE");
  assert.match(bad!.fix, /Re-export/);
});
