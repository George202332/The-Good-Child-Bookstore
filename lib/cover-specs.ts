/**
 * Cover dimensions an author needs to design a full-wrap cover, worked out from the exact size Lulu's
 * cover-dimensions service gives for the book (so it follows the page count, trim size, paper and binding),
 * plus a downloadable guide template drawn from those same numbers. Lulu's API offers no template file of
 * its own, so the template is generated here. Pure functions, so they can be tested.
 */

/** Bleed Lulu asks for on every outer edge. */
export const COVER_BLEED_IN = 0.125;
/** Keep text and important artwork at least this far inside the trim edge. */
export const COVER_SAFE_IN = 0.5;

export interface CoverDims {
  format: "paperback" | "hardcover";
  widthIn: number;
  heightIn: number;
  spineIn: number;
  trimWIn: number;
  trimHIn: number;
}

export interface CoverGuides extends CoverDims {
  /** How far the artwork must extend beyond the trim edge on every side (bleed, plus the wrap for a hardcover). */
  outerIn: number;
  bleedIn: number;
  /** The part of the outer margin that wraps round the board of a hardcover (0 for a paperback). */
  wrapIn: number;
  safeIn: number;
}

export function coverGuides(d: CoverDims): CoverGuides {
  const outerIn = Math.max(0, (d.heightIn - d.trimHIn) / 2);
  const bleedIn = Math.min(COVER_BLEED_IN, outerIn);
  return { ...d, outerIn: +outerIn.toFixed(3), bleedIn, wrapIn: +Math.max(0, outerIn - bleedIn).toFixed(3), safeIn: COVER_SAFE_IN };
}

const PT = 72;

/** PDF's standard fonts only cover Latin-1; anything else is shown as "?" so a title can never break the file. */
export function pdfSafeText(text: string): string {
  return Array.from(text).map((c) => (c.codePointAt(0)! <= 255 && c.codePointAt(0)! >= 32 ? c : "?")).join("");
}

export interface CoverTemplateInfo { title?: string; trimLabel: string; pageCount?: number }

/**
 * The downloadable cover template: ONE PDF page at exactly the full-wrap size (back cover, spine, front cover),
 * with the guides drawn at true size. Colours: pink = bleed, orange = hardcover wrap, black = trim, green dashed = safe
 * zone, blue dashed = spine fold lines, grey box = barcode area. A header note and a legend sit inside the back cover.
 */
export async function coverTemplatePdf(g: CoverGuides, info: CoverTemplateInfo): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const W = g.widthIn * PT, H = g.heightIn * PT;
  const page = doc.addPage([W, H]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const C = {
    bleed: rgb(1, 0.82, 0.82), bleedLine: rgb(0.85, 0.15, 0.15), wrap: rgb(1, 0.9, 0.72), trim: rgb(0, 0, 0),
    safe: rgb(0.1, 0.55, 0.25), fold: rgb(0.15, 0.35, 0.85), spine: rgb(0.87, 0.92, 1), ink: rgb(0.15, 0.15, 0.15), grey: rgb(0.45, 0.45, 0.45),
  };
  const o = g.outerIn * PT, bleed = g.bleedIn * PT, tw = g.trimWIn * PT, th = g.trimHIn * PT, sp = g.spineIn * PT, safe = g.safeIn * PT;
  const backX = o, spineX = o + tw, frontX = o + tw + sp;
  const rect = (x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>) => page.drawRectangle({ x, y, width: w, height: h, color });
  const frame = (x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>, dash?: number[], width = 0.9) =>
    page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: width, borderDashArray: dash, borderDashPhase: 0 });
  const t = (text: string, x: number, y: number, size: number, opts: { font?: typeof bold; color?: ReturnType<typeof rgb>; rotate?: number } = {}) =>
    page.drawText(pdfSafeText(text), { x, y, size, font: opts.font ?? reg, color: opts.color ?? C.ink, rotate: opts.rotate ? degrees(opts.rotate) : undefined });
  const center = (text: string, cx: number, y: number, size: number, font = reg, color = C.ink) => t(text, cx - font.widthOfTextAtSize(pdfSafeText(text), size) / 2, y, size, { font, color });

  // Outer margin: wrap (orange) first, then the bleed strip (pink) on top of its outer edge.
  rect(0, 0, W, H, g.wrapIn > 0 ? C.wrap : C.bleed);
  if (g.wrapIn > 0) {
    rect(0, 0, W, bleed, C.bleed); rect(0, H - bleed, W, bleed, C.bleed); rect(0, 0, bleed, H, C.bleed); rect(W - bleed, 0, bleed, H, C.bleed);
  }
  rect(o, o, W - 2 * o, th, rgb(1, 1, 1));
  rect(spineX, o, sp, th, C.spine);
  // Trim, safe zones and folds
  frame(o, o, W - 2 * o, th, C.trim, undefined, 1);
  frame(bleed, bleed, W - 2 * bleed, H - 2 * bleed, C.bleedLine, [4, 3], 0.8);
  frame(backX + safe, o + safe, Math.max(0, tw - 2 * safe), Math.max(0, th - 2 * safe), C.safe, [5, 3]);
  frame(frontX + safe, o + safe, Math.max(0, tw - 2 * safe), Math.max(0, th - 2 * safe), C.safe, [5, 3]);
  for (const x of [spineX, frontX]) page.drawLine({ start: { x, y: 0 }, end: { x, y: H }, thickness: 0.9, color: C.fold, dashArray: [6, 4] });

  // Panel labels
  const mid = o + th / 2;
  center("BACK COVER", backX + tw / 2, mid, 22, bold, C.grey);
  center("FRONT COVER", frontX + tw / 2, mid, 22, bold, C.grey);
  if (sp >= 0.22 * PT) t(`SPINE ${g.spineIn.toFixed(3)} in`, spineX + sp / 2 + Math.min(5, sp * 0.18), mid - 40, Math.min(11, sp * 0.45), { font: bold, color: C.fold, rotate: 90 });
  else center("SPINE", spineX + sp / 2, o + th + 4, 6, bold, C.fold);

  // Header note (inside the back cover, top, inside the safe zone)
  const hx = backX + safe + 6;
  let hy = o + th - safe - 14;
  const line = (text: string, size = 10, font = reg) => { t(text, hx, hy, size, { font }); hy -= size + 4; };
  line(info.title ? `Title: ${info.title}` : "Cover template", 12, bold);
  line(`Trim size: ${info.trimLabel}${info.pageCount ? `   Pages: ${info.pageCount}` : ""}`);
  line(`Spine width: ${g.spineIn.toFixed(3)} in`);
  line(`Full wrap: ${g.widthIn.toFixed(3)} x ${g.heightIn.toFixed(3)} in (${g.format === "hardcover" ? "Hardcover" : "Paperback"})`);
  line(`Bleed: ${g.bleedIn} in${g.wrapIn > 0 ? `   Wrap: ${g.wrapIn.toFixed(3)} in` : ""}   Safe margin: ${g.safeIn} in`);

  // Barcode area: back cover, lower right, inside the safe zone (2 in x 1.2 in)
  const bw = Math.min(2 * PT, tw - 2 * safe), bh = 1.2 * PT;
  const bx = backX + tw - safe - bw, by = o + safe;
  page.drawRectangle({ x: bx, y: by, width: bw, height: bh, color: rgb(0.93, 0.93, 0.93), borderColor: C.grey, borderWidth: 0.8 });
  center("BARCODE AREA", bx + bw / 2, by + bh / 2 - 3, 9, bold, C.grey);

  // Legend (back cover, lower left, inside the safe zone)
  const lx = backX + safe + 6;
  let ly = o + safe + 62;
  const swatch = (color: ReturnType<typeof rgb>, label: string, line?: boolean) => {
    if (line) page.drawLine({ start: { x: lx, y: ly + 3 }, end: { x: lx + 18, y: ly + 3 }, thickness: 1.2, color, dashArray: [4, 2] });
    else page.drawRectangle({ x: lx, y: ly, width: 18, height: 7, color, borderColor: C.grey, borderWidth: 0.3 });
    t(label, lx + 24, ly, 8);
    ly -= 11;
  };
  t("LEGEND", lx, ly + 11, 8, { font: bold });
  swatch(C.bleed, "Bleed: artwork must reach the edge");
  if (g.wrapIn > 0) swatch(C.wrap, "Wrap: folds round the board");
  swatch(C.trim, "Trim line (where the book is cut)");
  swatch(C.safe, "Safe zone: keep text inside", true);
  swatch(C.fold, "Fold lines (spine edges)", true);

  doc.setTitle(`${g.format} cover template`);
  return doc.save();
}
