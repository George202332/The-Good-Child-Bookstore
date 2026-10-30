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

const r = (n: number) => +n.toFixed(3);

/** An SVG guide at true size (1 user unit = 1 inch): bleed edge, trim lines, safe area, spine and fold lines. */
export function coverTemplateSvg(g: CoverGuides, pageCount?: number): string {
  const { widthIn: W, heightIn: H, outerIn: o, trimWIn: tw, trimHIn: th, spineIn: sp, safeIn: s } = g;
  const backX = o, spineX = o + tw, frontX = o + tw + sp;
  const label = g.format === "hardcover" ? "Hardcover" : "Paperback";
  const fs = Math.min(0.22, Math.max(0.1, tw / 20));
  const text = (x: number, y: number, t: string, anchor = "middle", size = fs, fill = "#555") =>
    `<text x="${r(x)}" y="${r(y)}" font-family="Arial, Helvetica, sans-serif" font-size="${r(size)}" fill="${fill}" text-anchor="${anchor}">${t}</text>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r(W)}in" height="${r(H)}in" viewBox="0 0 ${r(W)} ${r(H)}">`,
    `<rect width="${r(W)}" height="${r(H)}" fill="#ffffff"/>`,
    // bleed / wrap area (outside the trim)
    `<rect width="${r(W)}" height="${r(H)}" fill="#ffe3e3"/>`,
    `<rect x="${r(o)}" y="${r(o)}" width="${r(W - 2 * o)}" height="${r(H - 2 * o)}" fill="#ffffff"/>`,
    // spine
    `<rect x="${r(spineX)}" y="${r(o)}" width="${r(sp)}" height="${r(th)}" fill="#e8f0ff"/>`,
    // safe areas
    `<rect x="${r(backX + s)}" y="${r(o + s)}" width="${r(tw - 2 * s)}" height="${r(th - 2 * s)}" fill="none" stroke="#2a9d4a" stroke-width="0.012" stroke-dasharray="0.06 0.04"/>`,
    `<rect x="${r(frontX + s)}" y="${r(o + s)}" width="${r(tw - 2 * s)}" height="${r(th - 2 * s)}" fill="none" stroke="#2a9d4a" stroke-width="0.012" stroke-dasharray="0.06 0.04"/>`,
    // trim lines and spine folds
    `<rect x="${r(o)}" y="${r(o)}" width="${r(W - 2 * o)}" height="${r(th)}" fill="none" stroke="#d62828" stroke-width="0.012"/>`,
    `<line x1="${r(spineX)}" y1="0" x2="${r(spineX)}" y2="${r(H)}" stroke="#3366cc" stroke-width="0.01" stroke-dasharray="0.08 0.05"/>`,
    `<line x1="${r(frontX)}" y1="0" x2="${r(frontX)}" y2="${r(H)}" stroke="#3366cc" stroke-width="0.01" stroke-dasharray="0.08 0.05"/>`,
    text(backX + tw / 2, H / 2, "BACK COVER", "middle", fs * 1.4),
    text(frontX + tw / 2, H / 2, "FRONT COVER", "middle", fs * 1.4),
    sp >= 0.25 ? `<text transform="translate(${r(spineX + sp / 2 + fs / 3)} ${r(H / 2)}) rotate(-90)" font-family="Arial, Helvetica, sans-serif" font-size="${r(Math.min(fs, sp * 0.5))}" fill="#555" text-anchor="middle">SPINE ${r(sp)} in</text>` : "",
    text(W / 2, 0.16, `${label} cover wrap ${r(W)} x ${r(H)} in${pageCount ? `, ${pageCount} pages` : ""}`, "middle", 0.13, "#222"),
    text(W / 2, H - 0.06, `Pink = bleed${g.wrapIn > 0 ? " and wrap" : ""} (${r(o)} in beyond trim, artwork must reach it)  |  Red = trim  |  Green = keep text inside (${s} in from trim)  |  Blue = spine folds`, "middle", 0.1, "#222"),
    `</svg>`,
  ].filter(Boolean).join("\n");
}
