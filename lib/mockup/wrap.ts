/**
 * The cover artwork the mockups are made from: the very same wrap that is sent to Lulu.
 *
 *   - If the author uploaded their own full-wrap PDF, its first page is drawn to a picture here and cut into back, spine and front.
 *   - Otherwise the wrap is rebuilt exactly as lib/lulu-cover.ts builds it for Lulu (front artwork fitted over the front panel and
 *     its bleed, a solid colour taken from the front cover for the back and spine, the spine writing from lib/spine-text.ts),
 *     and cut the same way.
 *
 * Drawing a PDF needs a canvas library on the server (@napi-rs/canvas, which pdfjs-dist uses). If it is not available the
 * author's own wrap cannot be shown, and the caller is told why (it never silently shows something else).
 */

import { coverLayout, pickBackColor, BACK_SAFE_MARGIN_PT, type CoverLayout } from "@/lib/lulu-cover";
import { computeCoverGeometry } from "@/lib/cover-preview";
import { planSpineText, SPINE_CENTRE_K } from "@/lib/spine-text";
import { layoutBackDescription } from "@/lib/back-cover";
import { loadFont } from "@/lib/mockup/text-paths";
import { trimInches } from "@/lib/mockup/spec";

export interface WrapCrops {
  /** Pictures (JPEG) of the three panels exactly as they print, bleed removed. */
  front: Buffer;
  spine: Buffer;
  back: Buffer;
  source: "custom" | "generated";
}

export class WrapError extends Error {}

/** Draws the first page of a PDF to a PNG, at most `maxWidthPx` wide. */
export async function rasterizeFirstPage(pdf: Uint8Array, maxWidthPx = 2600): Promise<{ png: Buffer; widthPt: number; heightPt: number }> {
  let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  let canvasLib: { createCanvas(w: number, h: number): { getContext(t: "2d"): unknown; toBuffer(mime: "image/png"): Buffer } };
  try {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    canvasLib = (await import("@napi-rs/canvas")) as unknown as typeof canvasLib;
  } catch {
    throw new WrapError("This server cannot draw PDF pages to pictures, so your own wrap cover cannot be shown in the mockup.");
  }
  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: false, disableFontFace: true }).promise;
    const page = await doc.getPage(1);
    const v1 = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, maxWidthPx / v1.width) });
    const canvas = canvasLib.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext("2d") as never, viewport, canvas: canvas as never }).promise;
    return { png: canvas.toBuffer("image/png"), widthPt: v1.width, heightPt: v1.height };
  } catch (e) {
    throw new WrapError(`Your wrap cover PDF could not be drawn (${e instanceof Error ? e.message.slice(0, 120) : "unknown reason"}).`);
  }
}

async function cropPanels(source: Buffer, scale: number, L: CoverLayout, kind: "custom" | "generated"): Promise<WrapCrops> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(source).metadata();
  const maxW = meta.width ?? 1, maxH = meta.height ?? 1;
  const box = (xPt: number, wPt: number) => {
    const left = Math.max(0, Math.min(maxW - 1, Math.round(xPt * scale)));
    const top = Math.max(0, Math.min(maxH - 1, Math.round(L.margin * scale)));
    return { left, top, width: Math.max(1, Math.min(maxW - left, Math.round(wPt * scale))), height: Math.max(1, Math.min(maxH - top, Math.round(L.trimH * scale))) };
  };
  const out = (region: ReturnType<typeof box>, width: number) =>
    sharp(source).extract(region).resize({ width, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  const [front, spine, back] = await Promise.all([
    out(box(L.frontX, L.trimW), 1200),
    out(box(L.spineX, L.spine), 400),
    out(box(L.backX, L.trimW), 1200),
  ]);
  return { front, spine, back, source: kind };
}

/** The author's own wrap PDF, cut into panels. Throws a WrapError with the reason in plain words. */
export async function customWrapCrops(pdf: Uint8Array, trimCode: string): Promise<WrapCrops> {
  const trim = trimInches(trimCode);
  const { png, widthPt, heightPt } = await rasterizeFirstPage(pdf);
  const L = coverLayout(widthPt, heightPt, trim.w, trim.h);
  if (!L) throw new WrapError("Your wrap cover PDF does not match the trim size chosen, so it cannot be shown in the mockup.");
  const pixelsWide = (await (await import("sharp")).default(png).metadata()).width ?? widthPt;
  return cropPanels(png, pixelsWide / widthPt, L, "custom");
}

/** The wrap the site builds for Lulu when there is no uploaded wrap, cut into panels without leaving sharp. */
export async function generatedWrapCrops(opts: { frontImage: Buffer; title: string; author: string; description?: string; trimCode: string; paperCode: string; pages: number }): Promise<WrapCrops> {
  const sharp = (await import("sharp")).default;
  const geo = computeCoverGeometry(opts.trimCode, opts.paperCode, opts.pages);
  const L = coverLayout(
    (geo.trimWidthIn * 2 + geo.spineWidthIn + geo.bleedIn * 2) * 72,
    (geo.trimHeightIn + geo.bleedIn * 2) * 72,
    geo.trimWidthIn, geo.trimHeightIn,
  );
  if (!L) throw new WrapError("The cover size could not be worked out for this trim size.");
  const k = 3; // picture pixels per PDF point

  const avgRaw = await sharp(opts.frontImage).resize(1, 1).removeAlpha().raw().toBuffer();
  const back = pickBackColor({ r: avgRaw[0] ?? 128, g: avgRaw[1] ?? 128, b: avgRaw[2] ?? 128 });
  const bg = { r: back.r, g: back.g, b: back.b };

  // Front: the artwork is fitted over the front panel and its bleed (as the PDF does), then the trim part is kept.
  const regionW = Math.round((L.width - L.frontX) * k), regionH = Math.round(L.height * k);
  const fitted = await sharp(opts.frontImage).rotate().resize({ width: regionW, height: regionH, fit: "cover", position: "centre" }).toBuffer();
  const front = await sharp(fitted)
    .extract({ left: 0, top: Math.round(L.margin * k), width: Math.min(regionW, Math.round(L.trimW * k)), height: Math.min(regionH - Math.round(L.margin * k), Math.round(L.trimH * k)) })
    .resize({ width: 1200, withoutEnlargement: true }).flatten({ background: bg }).jpeg({ quality: 90 }).toBuffer();

  // Spine: the solid colour with the shared writing plan, drawn as outlines of the same font the PDF embeds.
  const sw = Math.max(4, Math.round(L.spine * k)), sh = Math.round(L.trimH * k);
  const bold = await loadFont("Tinos_700Bold.ttf");
  const plan = planSpineText({ spine: sw, length: sh, unitsPerInch: 72 * k, title: opts.title, author: opts.author, width: (t, s) => bold.width(t, s) });
  const lum = (0.299 * back.r + 0.587 * back.g + 0.114 * back.b) / 255;
  const ink = lum > 0.55 ? "#141419" : "#ffffff";
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}"><rect width="${sw}" height="${sh}" fill="rgb(${back.r},${back.g},${back.b})"/>`;
  for (const line of plan?.lines ?? []) {
    svg += `<g transform="translate(${(sw / 2 - line.size * SPINE_CENTRE_K).toFixed(2)} ${line.start.toFixed(2)}) rotate(90)"><path d="${bold.path(line.text, line.size, 0, 0)}" fill="${ink}"/></g>`;
  }
  svg += "</svg>";
  const spine = await sharp(Buffer.from(svg), { density: 72 }).jpeg({ quality: 92 }).toBuffer();
  // Back: the solid colour with the description, left-aligned at 11 points inside the safe margins, outlined from the same font the PDF embeds.
  const bw = 1200, bh = Math.round(bw * (L.trimH / L.trimW)), kb = bw / L.trimW;
  const regular = await loadFont("Tinos_400Regular.ttf");
  let backSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh}" viewBox="0 0 ${bw} ${bh}"><rect width="${bw}" height="${bh}" fill="rgb(${back.r},${back.g},${back.b})"/>`;
  if (opts.description?.trim()) {
    const m = BACK_SAFE_MARGIN_PT * kb;
    const lay = layoutBackDescription({ text: opts.description, boxW: bw - 2 * m, boxH: bh - 2 * m, unitsPerInch: 72 * kb, width: (t, s) => regular.width(t, s) });
    for (const line of lay.lines) for (const w of line.words) {
      backSvg += `<path d="${regular.path(w.text, lay.size, m + w.x, m + line.baseline)}" fill="${ink}"/>`;
    }
  }
  backSvg += "</svg>";
  const backImg = await sharp(Buffer.from(backSvg), { density: 72 }).jpeg({ quality: 90 }).toBuffer();
  return { front, spine, back: backImg, source: "generated" };
}
