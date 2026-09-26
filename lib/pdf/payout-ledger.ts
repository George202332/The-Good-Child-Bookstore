import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { PayoutLedgerRow } from "@/actions/payout-ledger";

/**
 * The admin's internal payout ledger, as a PDF for record-keeping —
 * every payout ever queued (any status), landscape so all the columns
 * item 5 asked for fit without wrapping: account number, account
 * holder name, email, payment method, account/payment details, the
 * book-sales/affiliate split, the combined total, and paid/not-paid
 * status. Same visual language (Times New Roman, deep purple/cream) as
 * the existing payout-statement.ts and order-receipt.ts, so it reads
 * as one consistent family of financial documents rather than a
 * one-off.
 */

const PLUM = rgb(0.20, 0.03, 0.26);
const INK = rgb(0.165, 0.141, 0.22);
const INK_SOFT = rgb(0.42, 0.39, 0.47);
const LINE = rgb(0.906, 0.878, 0.937);
const CREAM = rgb(0.980, 0.965, 0.941);
const PAID_GREEN = rgb(0.12, 0.42, 0.28);
const PENDING_AMBER = rgb(0.54, 0.35, 0.04);

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

interface Col { label: string; w: number; align?: "left" | "right"; }

export async function buildPayoutLedgerPdf(rows: PayoutLedgerRow[]): Promise<Uint8Array> {
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
    page.drawText(str, { x, y: yy, size: opts.size ?? 8.5, font: opts.font ?? font, color: opts.color ?? INK });
  }
  function rightText(str: string, xRight: number, yy: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    const f = opts.font ?? font;
    const size = opts.size ?? 8.5;
    text(str, xRight - f.widthOfTextAtSize(str, size), yy, opts);
  }

  // ---- Header ----
  text("The Good Child Bookstore LTD", margin, y - 10, { font: bold, size: 12, color: PLUM });
  text("Payout Ledger — internal record", margin, y - 26, { size: 9.5, color: INK_SOFT });
  const generated = `Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  rightText(generated, margin + pageWidth, y - 10, { size: 9.5, color: INK_SOFT });
  rightText(`${rows.length} payout${rows.length === 1 ? "" : "s"}`, margin + pageWidth, y - 26, { size: 9.5, color: INK_SOFT });
  y -= 46;

  const cols: Col[] = [
    { label: "Acct #", w: 0.07 },
    { label: "Holder / Email", w: 0.19 },
    { label: "Method", w: 0.11 },
    { label: "Details", w: 0.22 },
    { label: "Book sales", w: 0.09, align: "right" },
    { label: "Affiliate", w: 0.09, align: "right" },
    { label: "Total", w: 0.08, align: "right" },
    { label: "Status", w: 0.08 },
    { label: "Requested", w: 0.07 },
  ];
  const colWidths = cols.map((c) => c.w * pageWidth);
  const colX = colWidths.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? margin : acc[i - 1] + colWidths[i - 1]], []);

  function drawHeaderRow() {
    ensureSpace(18);
    page.drawRectangle({ x: margin, y: y - 16, width: pageWidth, height: 16, color: PLUM });
    cols.forEach((c, i) => {
      const white = rgb(1, 1, 1);
      if (c.align === "right") rightText(c.label.toUpperCase(), colX[i] + colWidths[i] - 4, y - 12, { font: bold, size: 6.8, color: white });
      else text(c.label.toUpperCase(), colX[i] + 4, y - 12, { font: bold, size: 6.8, color: white });
    });
    y -= 16;
  }
  drawHeaderRow();
  redrawHeaderOnNewPage = drawHeaderRow;

  let totalBookSales = 0, totalAffiliate = 0, totalCombined = 0;

  for (const r of rows) {
    ensureSpace(24);
    page.drawLine({ start: { x: margin, y }, end: { x: margin + pageWidth, y }, thickness: 0.5, color: LINE });

    const clip = (s: string, colIdx: number) => {
      const maxChars = Math.floor((colWidths[colIdx] - 8) / 4.2);
      return s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s;
    };

    text(clip(r.accountNumber, 0), colX[0] + 4, y - 13, { size: 7.5 });
    text(clip(`${r.accountHolderName} / ${r.email}`, 1), colX[1] + 4, y - 13, { size: 7.5 });
    text(clip(r.paymentMethod, 2), colX[2] + 4, y - 13, { size: 7.5 });
    text(clip(r.accountDetails, 3), colX[3] + 4, y - 13, { size: 7.5 });
    rightText(r.bookSalesEarnings > 0 ? money(r.bookSalesEarnings) : "—", colX[4] + colWidths[4] - 4, y - 13, { size: 7.5 });
    rightText(r.affiliateEarnings > 0 ? money(r.affiliateEarnings) : "—", colX[5] + colWidths[5] - 4, y - 13, { size: 7.5 });
    rightText(money(r.combinedTotal), colX[6] + colWidths[6] - 4, y - 13, { font: bold, size: 7.5 });
    text(r.paid ? "Paid" : r.status === "REJECTED" ? "Rejected" : "Not paid", colX[7] + 4, y - 13, {
      size: 7.5, font: bold, color: r.paid ? PAID_GREEN : r.status === "REJECTED" ? INK_SOFT : PENDING_AMBER,
    });
    text(new Date(r.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }), colX[8] + 4, y - 13, { size: 7.5 });

    totalBookSales += r.bookSalesEarnings;
    totalAffiliate += r.affiliateEarnings;
    totalCombined += r.combinedTotal;
    y -= 22;
  }

  ensureSpace(30);
  page.drawLine({ start: { x: margin, y }, end: { x: margin + pageWidth, y }, thickness: 1, color: PLUM });
  y -= 4;
  text("TOTALS", margin + 4, y - 12, { font: bold, size: 8.5, color: PLUM });
  rightText(money(totalBookSales), colX[4] + colWidths[4] - 4, y - 12, { font: bold, size: 8.5, color: PLUM });
  rightText(money(totalAffiliate), colX[5] + colWidths[5] - 4, y - 12, { font: bold, size: 8.5, color: PLUM });
  rightText(money(totalCombined), colX[6] + colWidths[6] - 4, y - 12, { font: bold, size: 8.5, color: PLUM });

  const allPages = doc.getPages();
  allPages.forEach((p, i) => {
    p.drawText("Confidential — internal record only. Not for redistribution.", { x: margin, y: 20, size: 7, font: italic, color: INK_SOFT });
    const footerRight = `thegoodchildbookstore.com   Page ${i + 1} of ${allPages.length}`;
    const fw = font.widthOfTextAtSize(footerRight, 7);
    p.drawText(footerRight, { x: p.getWidth() - margin - fw, y: 20, size: 7, font, color: INK_SOFT });
  });

  return doc.save();
}
