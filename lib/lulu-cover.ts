/**
 * Builds the print-ready cover Lulu needs. Lulu prints the cover from ONE
 * PDF page that holds the whole wrap — back cover, spine and front cover —
 * at an exact size that depends on the book's trim size, paper and page
 * count (Lulu's own cover-dimensions service gives the exact size). The
 * site stores only the front cover picture, so for a book whose author did
 * not upload their own full-wrap PDF, this makes a plain wrap: the front
 * cover on the right, and the back cover and spine in a single solid colour
 * taken from the front cover, with the title on the spine when it is thick
 * enough to hold text.
 *
 * Pure layout maths lives in coverLayout() so it can be unit tested; the
 * PDF drawing itself runs on the server only.
 */

export interface CoverLayout {
  /** Page size in PDF points. */
  width: number;
  height: number;
  /** Outer margin on every side (bleed, plus the wrap for hardcovers). */
  margin: number;
  trimW: number;
  trimH: number;
  spine: number;
  /** Left edge of the front cover panel. */
  frontX: number;
  backX: number;
  spineX: number;
}

/** Positions of the back cover, spine and front cover on a wrap of the
 * given exact size, for a book with the given trim size (inches). */
export function coverLayout(widthPt: number, heightPt: number, trimWIn: number, trimHIn: number): CoverLayout | null {
  const trimW = trimWIn * 72;
  const trimH = trimHIn * 72;
  const margin = (heightPt - trimH) / 2;
  const spine = widthPt - 2 * margin - 2 * trimW;
  if (!(widthPt > 0) || !(heightPt > 0) || margin < 0 || spine < 0) return null;
  return {
    width: widthPt,
    height: heightPt,
    margin,
    trimW,
    trimH,
    spine,
    backX: margin,
    spineX: margin + trimW,
    frontX: margin + trimW + spine,
  };
}

/** Converts Lulu's reported size (value + unit) to PDF points. */
export function toPoints(value: number | string, unit: string | undefined): number {
  const n = Number(value);
  const u = (unit ?? "pt").toLowerCase();
  if (u === "in" || u === "inch" || u === "inches") return n * 72;
  if (u === "mm") return (n / 25.4) * 72;
  if (u === "cm") return (n / 2.54) * 72;
  return n; // pt
}

export function pickBackColor(avg: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  const lum = (0.299 * avg.r + 0.587 * avg.g + 0.114 * avg.b) / 255;
  // Same rule as the on-screen cover preview: a very light colour is darkened
  // a little so text on the spine stays readable.
  const k = lum > 0.6 ? 0.7 : 1;
  return { r: Math.round(avg.r * k), g: Math.round(avg.g * k), b: Math.round(avg.b * k) };
}

export async function buildCoverWrapPdf(opts: {
  layout: CoverLayout;
  frontImage: Buffer;
  title: string;
  author?: string;
}): Promise<Uint8Array> {
  const sharp = (await import("sharp")).default;
  const { PDFDocument, rgb, degrees } = await import("pdf-lib");
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const { readBundledFont } = await import("@/lib/pdf-fonts");
  const { layout: L } = opts;

  // pdf-lib embeds PNG/JPEG only; uploads are stored as WebP, so convert.
  const png = await sharp(opts.frontImage).resize({ height: 3300, withoutEnlargement: true }).png().toBuffer();
  const avg = await sharp(opts.frontImage).resize(1, 1).removeAlpha().raw().toBuffer();
  const back = pickBackColor({ r: avg[0] ?? 128, g: avg[1] ?? 128, b: avg[2] ?? 128 });

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([L.width, L.height]);
  page.drawRectangle({ x: 0, y: 0, width: L.width, height: L.height, color: rgb(back.r / 255, back.g / 255, back.b / 255) });

  // Front cover: fill the front panel and carry on through the bleed on the
  // right, top and bottom (centre-cropped to keep the artwork's proportions).
  const img = await doc.embedPng(png);
  const regionX = L.frontX;
  const regionW = L.width - L.frontX;
  const regionH = L.height;
  const scale = Math.max(regionW / img.width, regionH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: regionX + (regionW - w) / 2, y: (regionH - h) / 2, width: w, height: h });

  // Spine title, only when the spine is wide enough to read.
  if (L.spine >= 22) {
    // A real font file is embedded (Arimo Bold, open licence), never one of the 14 built-in names the
    // PDF would only refer to: Lulu rejects covers whose fonts are not stored in the file.
    const font = await doc.embedFont(await readBundledFont("Arimo_700Bold.ttf"), { subset: true });
    const lum = (0.299 * back.r + 0.587 * back.g + 0.114 * back.b) / 255;
    const ink = lum > 0.55 ? rgb(0.08, 0.08, 0.1) : rgb(1, 1, 1);
    const text = (opts.author ? `${opts.title}  —  ${opts.author}` : opts.title).replace(/[^\x20-\x7E]/g, "");
    const size = Math.min(14, L.spine * 0.5);
    const maxLen = L.trimH * 0.85;
    let t = text;
    while (t.length > 3 && font.widthOfTextAtSize(t, size) > maxLen) t = t.slice(0, -2);
    if (t !== text) t = `${t.trimEnd()}...`;
    const tw = font.widthOfTextAtSize(t, size);
    // Rotated 90° clockwise, reading top to bottom, centred on the spine.
    page.drawText(t, {
      x: L.spineX + L.spine / 2 + size * 0.35,
      y: L.height / 2 + tw / 2,
      size,
      font,
      color: ink,
      rotate: degrees(-90),
    });
  }

  const bytes = await doc.save();
  await verifyCoverFontsEmbedded(bytes);
  return bytes;
}

/** Every font in a generated cover must be stored inside the file. Throws, naming the problem, if not. */
export async function verifyCoverFontsEmbedded(bytes: Uint8Array): Promise<void> {
  const { PDFDocument } = await import("pdf-lib");
  const { scanFonts } = await import("@/lib/pdf-font-scan");
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const missing = [...new Set((await scanFonts(doc)).filter((f) => !f.embedded).map((f) => f.name))];
  if (missing.length > 0) {
    throw new Error(`The generated cover has fonts that are not embedded (${missing.join(", ")}), so Lulu would reject it.`);
  }
}
