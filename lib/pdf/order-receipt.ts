import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const CREAM = rgb(0.980, 0.965, 0.941);
const PLUM = rgb(0.20, 0.03, 0.26); // deep purple, matches the payout statement
const INK = rgb(0, 0, 0); // true black — per explicit instruction, for maximum clarity
const INK_SOFT = rgb(0.25, 0.23, 0.27); // darker than before — still a step down from pure black for secondary text, but no longer hard to read

export interface OrderReceiptData {
  orderId: string;
  customerName: string;
  purchaseDate: Date;
  items: { title: string; format: string; price: number }[];
  totalAmount: number;
}

/**
 * The digital receipt shown right after purchase and attached to the
 * confirmation email — deliberately matches the monthly payout
 * statement's visual language (cream background, deep purple, Times
 * New Roman throughout) so the two feel like they come from the same
 * real financial document system, not two unrelated designs.
 */
export async function generateOrderReceipt(data: OrderReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: CREAM });

  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const margin = 50;
  const pageWidth = page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  function text(str: string, x: number, yy: number, opts: { font?: typeof font; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    page.drawText(str, { x, y: yy, font: opts.font ?? font, size: opts.size ?? 11, color: opts.color ?? INK });
  }
  function rightText(str: string, xRight: number, yy: number, opts: { font?: typeof font; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    const f = opts.font ?? font;
    const size = opts.size ?? 11;
    const w = f.widthOfTextAtSize(str, size);
    text(str, xRight - w, yy, opts);
  }

  // Header
  text("The Good Child Bookstore LTD", margin, y - 10, { font: bold, size: 16, color: PLUM });
  text("Order Receipt", margin, y - 30, { font: italic, size: 13, color: INK_SOFT });
  rightText(`Receipt for: ${data.customerName}`, margin + pageWidth, y - 10, { size: 9.5, color: INK_SOFT });
  rightText(`Order: #${data.orderId.slice(0, 8).toUpperCase()}`, margin + pageWidth, y - 24, { size: 9.5, color: INK_SOFT });
  rightText(`Date: ${data.purchaseDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, margin + pageWidth, y - 38, { size: 9.5, color: INK_SOFT });
  y -= 70;

  page.drawLine({ start: { x: margin, y }, end: { x: margin + pageWidth, y }, thickness: 1, color: PLUM });
  y -= 24;

  // Table header — a real filled deep-purple row, not just colored
  // text, per explicit instruction.
  const headerRowHeight = 24;
  page.drawRectangle({ x: margin, y: y - headerRowHeight + 8, width: pageWidth, height: headerRowHeight, color: PLUM });
  text("TITLE", margin + 10, y, { font: bold, size: 9.5, color: CREAM });
  text("FORMAT", margin + 320, y, { font: bold, size: 9.5, color: CREAM });
  rightText("PRICE", margin + pageWidth - 10, y, { font: bold, size: 9.5, color: CREAM });
  y -= headerRowHeight + 4;

  for (const item of data.items) {
    text(item.title, margin, y, { size: 11 });
    text(item.format.charAt(0).toUpperCase() + item.format.slice(1), margin + 320, y, { size: 11, color: INK });
    rightText(`$${item.price.toFixed(2)}`, margin + pageWidth, y, { size: 11 });
    y -= 22;
  }

  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + pageWidth, y }, thickness: 1, color: PLUM });
  y -= 28;

  text("Total Paid", margin, y, { font: bold, size: 13 });
  rightText(`$${data.totalAmount.toFixed(2)}`, margin + pageWidth, y, { font: bold, size: 18, color: PLUM });

  y -= 60;
  text("Thank you for shopping with The Good Child Bookstore.", margin, y, { font: italic, size: 10.5, color: INK_SOFT });
  y -= 16;
  text("Purchased eBooks and audiobooks are available any time from your Library.", margin, y, { size: 9.5, color: INK });

  return doc.save();
}
