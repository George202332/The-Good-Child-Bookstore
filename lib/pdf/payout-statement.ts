import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { PayoutStatementData } from "../payout-statement-data";

/**
 * Renders the monthly payout statement PDF — matches the layout of the
 * reference statement sample (gcb-payout-*.pdf): header block, a Total
 * Payout summary box, a Revenue Breakdown table, a Direct Sales by
 * Title table, a Referral Commissions table (omitted if empty), and a
 * confidentiality footer.
 *
 * Uses pdf-lib rather than pdfkit: pdfkit's font-handling dependency
 * (fontkit) doesn't build under Turbopack (a real, verified
 * incompatibility — the build failed with an unresolvable export
 * error several layers deep in fontkit's own dependencies). pdf-lib's
 * built-in standard fonts (Helvetica) need no font-embedding library at
 * all, sidestepping the problem entirely.
 */

const CORAL = rgb(0.886, 0.447, 0.357);
const INK = rgb(0.165, 0.141, 0.22);
const INK_SOFT = rgb(0.42, 0.39, 0.47);
const LINE = rgb(0.906, 0.878, 0.847);
const PAID_GREEN = rgb(0.12, 0.42, 0.28);
const PENDING_AMBER = rgb(0.54, 0.35, 0.04);

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

interface Col { label: string; w: number; align?: "left" | "right"; }

export async function buildPayoutStatementPdf(data: PayoutStatementData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  let page = doc.addPage([595.28, 841.89]); // A4
  const margin = 40;
  const pageWidth = page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  function ensureSpace(needed: number) {
    if (y - needed < margin + 40) {
      page = doc.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
    }
  }

  function text(str: string, x: number, yy: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    page.drawText(str, { x, y: yy, size: opts.size ?? 9, font: opts.font ?? font, color: opts.color ?? INK });
  }
  function rightText(str: string, xRight: number, yy: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    const f = opts.font ?? font;
    const size = opts.size ?? 9;
    const w = f.widthOfTextAtSize(str, size);
    text(str, xRight - w, yy, opts);
  }
  function rect(x: number, yTop: number, w: number, h: number, fill?: ReturnType<typeof rgb>, border?: ReturnType<typeof rgb>) {
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: fill, borderColor: border, borderWidth: border ? 1 : 0 });
  }
  function hLine(x1: number, x2: number, yy: number, color = LINE, thickness = 0.5) {
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness, color });
  }

  function drawTable(cols: Col[], rows: string[][], totals?: { label: string; sub?: string; value: string }[]) {
    const x0 = margin;
    const colWidths = cols.map((c) => c.w * pageWidth);
    const colX = colWidths.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? x0 : acc[i - 1] + colWidths[i - 1]], []);

    ensureSpace(20 + rows.length * 20 + 40);
    rect(x0, y, pageWidth, 20, rgb(0.984, 0.965, 0.937));
    cols.forEach((c, i) => {
      const align = c.align ?? "left";
      const label = c.label.toUpperCase();
      if (align === "right") rightText(label, colX[i] + colWidths[i] - 6, y - 14, { font: bold, size: 7.5, color: INK_SOFT });
      else text(label, colX[i] + 6, y - 14, { font: bold, size: 7.5, color: INK_SOFT });
    });
    y -= 20;

    rows.forEach((row) => {
      hLine(x0, x0 + pageWidth, y, LINE);
      row.forEach((cell, i) => {
        const align = cols[i].align ?? "left";
        const size = 8.5;
        const maxChars = Math.floor((colWidths[i] - 10) / (size * 0.52));
        const clipped = cell.length > maxChars ? cell.slice(0, maxChars - 1) + "…" : cell;
        if (align === "right") rightText(clipped, colX[i] + colWidths[i] - 6, y - 15, { size });
        else text(clipped, colX[i] + 6, y - 15, { size });
      });
      y -= 20;
    });

    if (totals) {
      hLine(x0, x0 + pageWidth, y, INK, 1);
      y -= 4;
      totals.forEach((t) => {
        text(t.label, x0 + 6, y - 10, { font: bold, size: 9 });
        if (t.sub) text(t.sub, x0 + 6, y - 21, { font, size: 7, color: INK_SOFT });
        rightText(t.value, x0 + pageWidth - 6, y - 10, { font: bold, size: 10.5, color: CORAL });
        y -= t.sub ? 30 : 20;
      });
    }
    y -= 16;
  }

  // ---- Header ----
  text("GCB", margin, y - 18, { font: bold, size: 20, color: CORAL });
  text("The Good Child Bookstore", margin, y - 36, { font: bold, size: 11 });
  text("Monthly Payout Statement", margin, y - 54, { font: bold, size: 15 });
  y -= 80;
  text(`Statement for: ${data.authorName}`, margin, y, { size: 9, color: INK_SOFT });
  text(`Period: ${data.monthLabel}`, margin, y - 14, { size: 9, color: INK_SOFT });
  text(`Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, margin, y - 28, { size: 9, color: INK_SOFT });
  y -= 44;

  // ---- Total payout box ----
  const boxH = 78;
  rect(margin, y, pageWidth, boxH, rgb(0.984, 0.965, 0.937), LINE);
  text("TOTAL PAYOUT", margin + 16, y - 16, { font: bold, size: 8.5, color: INK_SOFT });
  text(money(data.totalPayout), margin + 16, y - 38, { font: bold, size: 22, color: CORAL });

  const col2 = margin + 280, col3 = margin + 420;
  text("PERIOD", col2, y - 16, { font: bold, size: 8, color: INK_SOFT });
  text("PAYOUT DATE", col3, y - 16, { font: bold, size: 8, color: INK_SOFT });
  text(data.monthLabel, col2, y - 30, { size: 10 });
  text(data.payoutDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), col3, y - 30, { size: 10 });
  text("STATUS", col2, y - 52, { font: bold, size: 8, color: INK_SOFT });
  text("AUTHOR", col3, y - 52, { font: bold, size: 8, color: INK_SOFT });
  text(data.status === "Paid" ? "Paid" : "Pending", col2, y - 66, { font: bold, size: 10, color: data.status === "Paid" ? PAID_GREEN : PENDING_AMBER });
  text(data.authorName, col3, y - 66, { size: 10 });
  y -= boxH + 26;

  // ---- Revenue breakdown ----
  ensureSpace(60);
  text("Revenue breakdown", margin, y, { font: bold, size: 13 });
  text(`How your total payout for ${data.monthLabel} is composed`, margin, y - 15, { size: 8, color: INK_SOFT });
  y -= 32;

  drawTable(
    [{ label: "Revenue source", w: 0.28 }, { label: "Description", w: 0.5 }, { label: "Amount", w: 0.22, align: "right" }],
    [
      ["Direct sales: organic", "Reader found your book directly", money(data.organicRevenue)],
      ["Direct sales: affiliate", "Readers arrived via an affiliate link", money(data.affiliateChannelRevenue)],
      ["Referral commissions", "5% of company revenue from authors you referred", money(data.referralCommission)],
      ["Promotion commissions", "10% on copies sold via your promotional links", money(data.promotionCommission)],
    ],
    [{ label: "TOTAL PAYOUT", sub: `Payable on ${data.payoutDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, value: money(data.totalPayout) }]
  );

  // ---- Direct sales by title ----
  if (data.titleRows.length > 0) {
    ensureSpace(60);
    text("Direct sales: by title", margin, y, { font: bold, size: 13 });
    text(`Individual book performance for ${data.monthLabel}`, margin, y - 15, { size: 8, color: INK_SOFT });
    y -= 32;
    const totals = data.titleRows.reduce(
      (acc, r) => ({ copies: acc.copies + r.copies, gross: acc.gross + r.gross, earnings: acc.earnings + r.authorEarnings }),
      { copies: 0, gross: 0, earnings: 0 }
    );
    drawTable(
      [
        { label: "Title", w: 0.26 }, { label: "ISBN", w: 0.16 }, { label: "Format", w: 0.1 },
        { label: "Price", w: 0.1, align: "right" }, { label: "Copies", w: 0.1, align: "right" },
        { label: "Gross", w: 0.12, align: "right" }, { label: "Company", w: 0.08, align: "right" }, { label: "Affiliate", w: 0.08, align: "right" },
      ],
      data.titleRows.map((r) => [r.title, r.isbn, r.format, money(r.price), String(r.copies), money(r.gross), money(r.companyShare), money(r.affiliateShare)]),
      [{ label: "TOTALS", value: `${totals.copies} copies · ${money(totals.gross)} gross · ${money(totals.earnings)} your earnings` }]
    );
  }

  // ---- Referral commissions detail ----
  if (data.referralRows.length > 0) {
    ensureSpace(60);
    text("Referral commissions", margin, y, { font: bold, size: 13 });
    text(`5% of company revenue from authors you referred (${data.monthLabel})`, margin, y - 15, { size: 8, color: INK_SOFT });
    y -= 32;
    drawTable(
      [
        { label: "Author", w: 0.3 }, { label: "Account ID", w: 0.2 },
        { label: "Gross revenue", w: 0.17, align: "right" }, { label: "Company revenue (30%)", w: 0.17, align: "right" }, { label: "Your commission", w: 0.16, align: "right" },
      ],
      data.referralRows.map((r) => [r.authorName, r.accountId, money(r.grossRevenue), money(r.companyRevenue), money(r.commission)]),
      [{ label: "TOTAL", value: money(data.referralCommission) }]
    );
  }

  // ---- Footer (on every page) ----
  for (const p of doc.getPages()) {
    p.drawText("Confidential: prepared for the named author only. Not for redistribution.", { x: margin, y: 30, size: 7.5, font: italic, color: INK_SOFT });
    const footerRight = "thegoodchildbookstore.com";
    const fw = font.widthOfTextAtSize(footerRight, 7.5);
    p.drawText(footerRight, { x: p.getWidth() - margin - fw, y: 30, size: 7.5, font, color: INK_SOFT });
  }

  return doc.save();
}
