import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { readFile } from "fs/promises";
import path from "path";
import type { PayoutStatementData, PayoutStatementFormatRow } from "../payout-statement-data";

/**
 * Renders the monthly payout statement PDF. Rebuilt per explicit
 * instruction: Times New Roman throughout (pdf-lib's built-in
 * Times-Roman standard font — no font file to embed, and no risk of
 * the fontkit/Turbopack incompatibility that ruled out pdfkit
 * originally), purple color scheme matching the company seal, the
 * company seal itself stamped on the report (embedded exactly as
 * uploaded, unmodified), and four independent revenue sections
 * (Direct Sales: Organic, Direct Sales: Affiliate, Referral Commission,
 * Promotion Commission) instead of one combined table.
 */

const PLUM = rgb(0.325, 0.114, 0.396); // deep purple, matches the seal's ring
const GOLD = rgb(0.62, 0.48, 0.18); // matches the seal's gold linework
const INK = rgb(0.165, 0.141, 0.22);
const INK_SOFT = rgb(0.42, 0.39, 0.47);
const LINE = rgb(0.906, 0.878, 0.937);
const PANEL = rgb(0.973, 0.961, 0.984);
const PAID_GREEN = rgb(0.12, 0.42, 0.28);
const PENDING_AMBER = rgb(0.54, 0.35, 0.04);

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

interface Col { label: string; w: number; align?: "left" | "right"; }

export async function buildPayoutStatementPdf(data: PayoutStatementData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  let sealImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  try {
    const sealBytes = await readFile(path.join(process.cwd(), "public", "branding", "company-seal.png"));
    sealImage = await doc.embedPng(sealBytes);
  } catch {
    // If the seal can't be read for any reason, the statement still
    // generates — just without the stamp, rather than failing entirely.
  }

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
    rect(x0, y, pageWidth, 20, PANEL);
    cols.forEach((c, i) => {
      const align = c.align ?? "left";
      const label = c.label.toUpperCase();
      if (align === "right") rightText(label, colX[i] + colWidths[i] - 6, y - 14, { font: bold, size: 7.5, color: PLUM });
      else text(label, colX[i] + 6, y - 14, { font: bold, size: 7.5, color: PLUM });
    });
    y -= 20;

    rows.forEach((row) => {
      hLine(x0, x0 + pageWidth, y, LINE);
      row.forEach((cell, i) => {
        const align = cols[i].align ?? "left";
        const size = 8.5;
        const maxChars = Math.floor((colWidths[i] - 10) / (size * 0.5));
        const clipped = cell.length > maxChars ? cell.slice(0, maxChars - 1) + "…" : cell;
        if (align === "right") rightText(clipped, colX[i] + colWidths[i] - 6, y - 15, { size });
        else text(clipped, colX[i] + 6, y - 15, { size });
      });
      y -= 20;
    });

    if (totals) {
      hLine(x0, x0 + pageWidth, y, PLUM, 1);
      y -= 4;
      totals.forEach((t) => {
        text(t.label, x0 + 6, y - 10, { font: bold, size: 9 });
        if (t.sub) text(t.sub, x0 + 6, y - 21, { font, size: 7, color: INK_SOFT });
        rightText(t.value, x0 + pageWidth - 6, y - 10, { font: bold, size: 10.5, color: PLUM });
        y -= t.sub ? 30 : 20;
      });
    }
    y -= 16;
  }

  function drawFormatSection(heading: string, sub: string, rows: PayoutStatementFormatRow[], totalLabel: string) {
    if (rows.length === 0) return;
    ensureSpace(60);
    text(heading, margin, y, { font: bold, size: 13, color: PLUM });
    text(sub, margin, y - 15, { size: 8, color: INK_SOFT });
    y -= 32;
    const totals = rows.reduce(
      (acc, r) => ({ copies: acc.copies + r.copies, gross: acc.gross + r.gross, earnings: acc.earnings + r.yourEarnings }),
      { copies: 0, gross: 0, earnings: 0 }
    );
    drawTable(
      [
        { label: "Title", w: 0.3 }, { label: "Format", w: 0.14 },
        { label: "Price", w: 0.12, align: "right" }, { label: "Copies", w: 0.1, align: "right" },
        { label: "Gross", w: 0.14, align: "right" }, { label: "Company", w: 0.1, align: "right" }, { label: "Earnings", w: 0.1, align: "right" },
      ],
      rows.map((r) => [r.title, r.format, money(r.price), String(r.copies), money(r.gross), money(r.companyShare), money(r.yourEarnings)]),
      [{ label: totalLabel, value: `${totals.copies} copies · ${money(totals.gross)} gross · ${money(totals.earnings)} earnings` }]
    );
  }

  // ---- Header ----
  text("GCB", margin, y - 18, { font: bold, size: 20, color: PLUM });
  text("The Good Child Bookstore", margin, y - 36, { font: bold, size: 11 });
  text("Monthly Payout Statement", margin, y - 54, { font: bold, size: 15 });
  y -= 80;
  text(`Statement for: ${data.authorName}`, margin, y, { size: 9, color: INK_SOFT });
  text(`Period: ${data.monthLabel}`, margin, y - 14, { size: 9, color: INK_SOFT });
  text(`Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, margin, y - 28, { size: 9, color: INK_SOFT });
  y -= 44;

  // ---- Total payout box ----
  const boxH = 78;
  rect(margin, y, pageWidth, boxH, PANEL, LINE);
  text("TOTAL PAYOUT", margin + 16, y - 16, { font: bold, size: 8.5, color: INK_SOFT });
  text(money(data.totalPayout), margin + 16, y - 38, { font: bold, size: 22, color: PLUM });

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

  // ---- Revenue breakdown (summary) ----
  ensureSpace(60);
  text("Revenue Breakdown", margin, y, { font: bold, size: 13, color: PLUM });
  text(`How your total payout for ${data.monthLabel} is composed`, margin, y - 15, { size: 8, color: INK_SOFT });
  y -= 32;

  drawTable(
    [{ label: "Revenue source", w: 0.28 }, { label: "Description", w: 0.5 }, { label: "Amount", w: 0.22, align: "right" }],
    [
      ["Direct sales: organic", "Reader found your book directly", money(data.organicRevenue)],
      ["Direct sales: affiliate", "Readers arrived via an affiliate link", money(data.affiliateChannelRevenue)],
      ["Referral commission", "Your tiered commission on the company's revenue from authors you referred", money(data.referralCommission)],
      ["Promotion commission", "Commission on copies sold via your promotional links", money(data.promotionCommission)],
    ],
    [{ label: "TOTAL PAYOUT", sub: `Payable on ${data.payoutDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, value: money(data.totalPayout) }]
  );

  // ---- Four independent sections ----
  drawFormatSection("Direct Sales: Organic", `Individual book performance for ${data.monthLabel} — readers who found your book directly`, data.organicRows, "TOTALS");
  drawFormatSection("Direct Sales: Affiliate", `Individual book performance for ${data.monthLabel} — readers who arrived via an affiliate link`, data.affiliateRows, "TOTALS");

  if (data.referralRows.length > 0) {
    ensureSpace(60);
    text("Referral Commission", margin, y, { font: bold, size: 13, color: PLUM });
    text(`Your tiered commission on the company's revenue from authors you referred (${data.monthLabel})`, margin, y - 15, { size: 8, color: INK_SOFT });
    y -= 32;
    drawTable(
      [
        { label: "Account ID", w: 0.25 },
        { label: "Gross", w: 0.25, align: "right" }, { label: "Company", w: 0.25, align: "right" }, { label: "Commission", w: 0.25, align: "right" },
      ],
      data.referralRows.map((r) => [r.accountId, money(r.grossRevenue), money(r.companyRevenue), money(r.commission)]),
      [{ label: "TOTAL", value: money(data.referralCommission) }]
    );
  }

  drawFormatSection("Promotion Commission", `Copies sold through your own promotional links for ${data.monthLabel}`, data.promotionRows, "TOTALS");

  // ---- Company seal (stamped, exactly as uploaded) ----
  if (sealImage) {
    ensureSpace(120);
    const sealSize = 90;
    const sealX = page.getWidth() - margin - sealSize;
    page.drawImage(sealImage, { x: sealX, y: y - sealSize, width: sealSize, height: sealSize, opacity: 0.92 });
    y -= sealSize + 10;
  }

  // ---- Footer (on every page) ----
  for (const p of doc.getPages()) {
    p.drawText("Confidential: prepared for the named author only. Not for redistribution.", { x: margin, y: 30, size: 7.5, font: italic, color: INK_SOFT });
    const footerRight = "thegoodchildbookstore.com";
    const fw = font.widthOfTextAtSize(footerRight, 7.5);
    p.drawText(footerRight, { x: p.getWidth() - margin - fw, y: 30, size: 7.5, font, color: GOLD });
  }

  return doc.save();
}
