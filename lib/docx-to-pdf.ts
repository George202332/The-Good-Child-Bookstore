import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 60;
const FONT_SIZE = 11;
const LINE_HEIGHT = 16;

/** Converts a DOCX file's text content into a real, readable PDF.
 * Extracts plain text via mammoth (preserving paragraph breaks), then
 * paginates and draws it with pdf-lib. This preserves readable text
 * and paragraph structure, not the original's visual formatting,
 * images, or tables — genuine full-fidelity DOCX rendering needs a
 * document-rendering service (e.g. headless LibreOffice), which is
 * real, separate infrastructure this doesn't have. */
export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Uint8Array> {
  const mammoth = await import("mammoth");
  const { value: rawText } = await mammoth.extractRawText({ buffer: docxBuffer });
  const paragraphs = rawText.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  function wrapLine(text: string): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, FONT_SIZE) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  for (const para of paragraphs) {
    const lines = wrapLine(para);
    for (const line of lines) {
      if (y < MARGIN) newPage();
      page.drawText(line, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0.1, 0.1, 0.1) });
      y -= LINE_HEIGHT;
    }
    y -= LINE_HEIGHT * 0.6; // paragraph spacing
  }

  return doc.save();
}
