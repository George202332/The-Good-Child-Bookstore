import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { PayoutLedgerRow } from "@/actions/payout-ledger";
import { buildPayoutExportTable } from "@/lib/payout-export";

/**
 * The payout PDF: the shared bank-transfer export table (see
 * lib/payout-export.ts), identical in rows and columns to the CSV and
 * Excel. Landscape A4, same visual language (Times, deep purple/cream)
 * as payout-statement.ts and order-receipt.ts.
 */

const PLUM = rgb(0.20, 0.03, 0.26);
const INK = rgb(0.165, 0.141, 0.22);
const INK_SOFT = rgb(0.42, 0.39, 0.47);
const LINE = rgb(0.906, 0.878, 0.937);
const CREAM = rgb(0.980, 0.965, 0.941);

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

interface Col { label: string; w: number; align?: "left" | "right"; }

export async function buildPayoutLedgerPdf(ledger: PayoutLedgerRow[]): Promise<Uint8Array> {
  const table = buildPayoutExportTable(ledger);
  const rows = table.body;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const PAGE_W = 841.89, PAGE_H = 595.28; // A4 landscape
  const margin = 36;
  const pageWidth = PAGE_W - margin * 2;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - margin;

  function newPage() {
    page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });
    y = PAGE_H - margin;
  }
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: CREAM });

  let redrawHeaderOnNewPage: (() => void) | null = null;
  function ensureSpace(needed: number) {
    if (y - needed < margin + 30) {
      newPage();
      redrawHeaderOnNewPage?.();
    }
  }

  function text(str: string, x: number, yy: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    // Standard PDF fonts only encode Latin-1; anything else would throw.
    str = str.replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "?");
    page.drawText(str, { x, y: yy, size: opts.size ?? 8.5, font: opts.font ?? font, color: opts.color ?? INK });
  }
  function rightText(str: string, xRight: number, yy: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    const f = opts.font ?? font;
    const size = opts.size ?? 8.5;
    text(str, xRight - f.widthOfTextAtSize(str, size), yy, opts);
  }

  // ---- Header ----
  text("The Good Child Bookstore LTD", margin, y - 10, { font: bold, size: 12, color: PLUM });
  text("Payouts due — bank transfer", margin, y - 26, { size: 9.5, color: INK_SOFT });
  const generated = `Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  rightText(generated, margin + pageWidth, y - 10, { size: 9.5, color: INK_SOFT });
  rightText(`${rows.length} payout${rows.length === 1 ? "" : "s"}`, margin + pageWidth, y - 26, { size: 9.5, color: INK_SOFT });
  y -= 46;

  const widthShare = [0.07, 0.10, 0.14, 0.10, 0.11, 0.10, 0.14, 0.07, 0.06, 0.11];
  const cols: Col[] = table.headers.map((label, i) => ({ label, w: widthShare[i], align: i === 9 ? "right" : "left" }));
  const colWidths = cols.map((c) => c.w * pageWidth);
  const colX = colWidths.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? margin : acc[i - 1] + colWidths[i - 1]], []);

  function drawHeaderRow() {
    ensureSpace(18);
    page.drawRectangle({ x: margin, y: y - 16, width: pageWidth, height: 16, color: PLUM });
    cols.forEach((c, i) => {
      const white = rgb(1, 1, 1);
      if (c.align === "right") rightText(c.label.toUpperCase(), colX[i] + colWidths[i] - 4, y - 12, { font: bold, size: 5.8, color: white });
      else text(c.label.toUpperCase(), colX[i] + 4, y - 12, { font: bold, size: 5.8, color: white });
    });
    y -= 16;
  }
  drawHeaderRow();
  redrawHeaderOnNewPage = drawHeaderRow;

  for (const cells of rows) {
    ensureSpace(24);
    page.drawLine({ start: { x: margin, y }, end: { x: margin + pageWidth, y }, thickness: 0.5, color: LINE });
    const clip = (str: string, colIdx: number) => {
      const maxChars = Math.floor((colWidths[colIdx] - 8) / 3.6);
      return str.length > maxChars ? str.slice(0, maxChars - 1) + "…" : str;
    };
    cells.forEach((cell, i) => {
      if (i === cells.length - 1) rightText(`$${cell}`, colX[i] + colWidths[i] - 4, y - 13, { font: bold, size: 7 });
      else text(clip(cell, i), colX[i] + 4, y - 13, { size: 7 });
    });
    y -= 22;
  }

  ensureSpace(30);
  page.drawLine({ start: { x: margin, y }, end: { x: margin + pageWidth, y }, thickness: 1, color: PLUM });
  y -= 4;
  text("TOTAL", margin + 4, y - 12, { font: bold, size: 8.5, color: PLUM });
  rightText(money(table.grandTotal), colX[9] + colWidths[9] - 4, y - 12, { font: bold, size: 8.5, color: PLUM });

  const allPages = doc.getPages();
  allPages.forEach((p, i) => {
    p.drawText("Confidential — internal record only. Not for redistribution.", { x: margin, y: 20, size: 7, font: italic, color: INK_SOFT });
    const footerRight = `thegoodchildbookstore.com   Page ${i + 1} of ${allPages.length}`;
    const fw = font.widthOfTextAtSize(footerRight, 7);
    p.drawText(footerRight, { x: p.getWidth() - margin - fw, y: 20, size: 7, font, color: INK_SOFT });
  });

  return doc.save();
}
