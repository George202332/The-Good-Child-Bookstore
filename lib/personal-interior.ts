import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { cleanMessage } from "@/lib/personal-message";

/**
 * Builds ONE order's interior: a copy of the author's interior PDF in which the page the author reserved for the dedication is
 * replaced by a fresh blank page of the same size carrying the buyer's message, centred, in an embedded font (Lulu rejects PDFs whose
 * fonts are not embedded). Page count, page size and every other page are exactly the author's, so the printing cost, the spine
 * and the page-count rules do not change. Pure: bytes in, bytes out (the caller stores and sends it).
 */
const FONT_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "lib", "pdf-fonts");
const FILES = {
  classic: "Tinos_400Regular.ttf",
  script: "Tinos_400Regular_Italic.ttf",
  simple: "Arimo_400Regular.ttf",
} as const;

export function wrapLines(text: string, measure: (s: string) => number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { out.push(""); continue; }
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (measure(next) <= maxWidth || !line) line = next; else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}

export async function buildPersonalisedInterior(opts: { source: Uint8Array; page: number; text: string; style: string }): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: string }> {
  const text = cleanMessage(opts.text);
  if (!text) return { ok: false, error: "There is no message to print." };
  const doc = await PDFDocument.load(opts.source);
  const count = doc.getPageCount();
  const index = opts.page - 1;
  if (index < 0 || index >= count) return { ok: false, error: `The reserved dedication page (${opts.page}) is not in this ${count}-page interior.` };
  const { width, height } = doc.getPage(index).getSize();
  doc.registerFontkit(fontkit);
  const style = (opts.style in FILES ? opts.style : "classic") as keyof typeof FILES;
  const font: PDFFont = await doc.embedFont(new Uint8Array(await readFile(path.join(FONT_DIR, FILES[style]))), { subset: true });
  doc.removePage(index);
  const page = doc.insertPage(index, [width, height]);
  const box = Math.min(width * 0.62, 4.2 * 72);
  let size = 16;
  let lines = wrapLines(text, (s) => font.widthOfTextAtSize(s, size), box);
  while (lines.length * size * 1.45 > height * 0.5 && size > 9) { size -= 1; lines = wrapLines(text, (s) => font.widthOfTextAtSize(s, size), box); }
  const lead = size * 1.45;
  let y = height * 0.58 + (lines.length * lead) / 2;
  for (const line of lines) {
    const w = font.widthOfTextAtSize(line, size);
    if (line) page.drawText(line, { x: (width - w) / 2, y, size, font, color: rgb(0, 0, 0) });
    y -= lead;
  }
  return { ok: true, bytes: await doc.save() };
}

/** The same page for the product page preview is drawn in the browser; this reads a stored PDF's bytes for the builder. */
export async function readStoredPdf(fileId: string): Promise<Uint8Array | null> {
  const { prisma } = await import("@/lib/prisma");
  const f = await prisma.uploadedFile.findUnique({ where: { id: fileId } });
  return f && f.mimeType === "application/pdf" ? new Uint8Array(f.data) : null;
}
