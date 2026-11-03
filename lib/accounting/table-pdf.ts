import type { PDFPage } from "pdf-lib";
import { drawTable, newDoc, PLUM, SOFT, RULE, WHITE, safe } from "@/lib/accounting/pdf-draw";
import type { ExportTable } from "@/lib/accounting/exports";

/** A landscape PDF of any exported list or ledger (same rows as the CSV). Library: pdf-lib. */
export async function buildTablePdf(t: ExportTable): Promise<Uint8Array> {
  const { doc, fonts } = await newDoc();
  const W = 841.89, H = 595.28, M = 32;
  const pages: PDFPage[] = [];
  const add = (): number => {
    const p = doc.addPage([W, H]);
    pages.push(p);
    p.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: PLUM });
    p.drawText(safe(`The Good Child Bookstore LTD  |  ${t.title}`), { x: M, y: H - 20, size: 10, font: fonts.bold, color: WHITE });
    return H - 48;
  };
  let y = add();
  const first = pages[0];
  first.drawText(safe(`${t.subtitle}  |  ${t.rows.length} row${t.rows.length === 1 ? "" : "s"}  |  Generated ${new Date().toISOString().slice(0, 10)}`), { x: M, y, size: 8.5, font: fonts.regular, color: SOFT });
  y -= 16;
  // Column widths follow the longest text in each column (clamped), so short columns stay narrow.
  const raw = t.headers.map((h, i) => Math.min(38, Math.max(7, h.length, ...t.rows.slice(0, 200).map((r) => (r[i] ?? "").length))));
  const sum = raw.reduce((a, b) => a + b, 0);
  const cols = t.headers.map((label, i) => ({ label, w: raw[i] / sum, align: t.aligns[i] }));
  drawTable({
    fonts, getPage: () => pages[pages.length - 1], onNewPage: add, x: M, y, width: W - M * 2, cols, rows: t.rows.length ? t.rows : [t.headers.map((_, i) => (i === 0 ? "Nothing to show for this period." : ""))],
    size: 7.5, bottom: 40,
  });
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 28 }, end: { x: W - M, y: 28 }, thickness: 0.5, color: RULE });
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: W - M - fonts.regular.widthOfTextAtSize(n, 7), y: 16, size: 7, font: fonts.regular, color: SOFT });
  });
  return doc.save();
}
