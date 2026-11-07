import { layoutBackDescription } from "@/lib/back-cover";
import { composeScene, standardScene, type BookDims, type TextureSet } from "@/lib/mockup/scene";
import { WrapError, type WrapCrops } from "@/lib/mockup/wrap";
import { planSpineText } from "@/lib/spine-text";
import { bookDimensions, LINEN_COLORS, trimInches, type MockupSpec } from "@/lib/mockup/spec";
import { loadFont, type TextFont } from "@/lib/mockup/text-paths";

/**
 * Makes the 3D mockup picture of a print book.
 *
 * Tools: sharp (picture handling, and turning the finished scene into a PNG), fontkit (letters as outlines, via our bundled
 * Arimo font) and our own small 3D scene (lib/mockup/scene.ts). All of it is plain JavaScript or ships inside sharp, so it
 * runs on Vercel with nothing extra installed.
 *
 * Limits: the front picture is the author's front cover image. If the author uploaded their own complete wrap as a PDF, the
 * back cover in the mockup is still drawn by us (a colour taken from the front cover, the short description and the barcode),
 * because a PDF can't be turned into a picture on the server. A picture takes roughly 1-3 seconds to make.
 */

const PX = 100; // texture pixels per inch

// Portrait, 2:3 - exactly the shape of the cover frame on the product page, so the picture drops into it unchanged.
const OUT_W = 1600;
const OUT_H = 2400;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let uid = 0;
const nextId = (p: string) => `${p}${++uid}`;

interface Rgb { r: number; g: number; b: number }
const hex = (c: Rgb) => "#" + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/** A colour for the spine and back of a paperback: the front cover's average colour, a little darker when it is very light. */
function backColourFrom(avg: Rgb): Rgb {
  const lum = (0.299 * avg.r + 0.587 * avg.g + 0.114 * avg.b) / 255;
  const k = lum > 0.6 ? 0.7 : 1;
  return { r: avg.r * k, g: avg.g * k, b: avg.b * k };
}
const inkFor = (c: Rgb) => ((0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.55 ? "#17171c" : "#ffffff");

function foilPaint(code: string, defs: string[]): string | null {
  if (code === "B") return "#121214";
  if (code === "W") return "#f7f7f4";
  if (code !== "G") return null;
  const id = nextId("foil");
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e08a"/><stop offset="0.35" stop-color="#c9992e"/><stop offset="0.6" stop-color="#f1d77a"/><stop offset="1" stop-color="#a97a1c"/></linearGradient>`);
  return `url(#${id})`;
}

function pagesEdge(w: number, h: number, vertical: boolean): string {
  const id = nextId("pg");
  const lines = vertical
    ? `<pattern id="${id}" width="4" height="${h}" patternUnits="userSpaceOnUse"><rect width="4" height="${h}" fill="#f6f0e1"/><rect x="0" width="1" height="${h}" fill="#d9d1bb"/></pattern>`
    : `<pattern id="${id}" width="${w}" height="4" patternUnits="userSpaceOnUse"><rect width="${w}" height="4" fill="#f6f0e1"/><rect y="0" width="${w}" height="1" fill="#d9d1bb"/></pattern>`;
  return `<defs>${lines}</defs><rect width="${w}" height="${h}" fill="url(#${id})"/>`;
}

interface Built { tex: TextureSet; defs: string[] }

let clothTileCache: Promise<string> | null = null;
/** A 256 x 256 tile of fine vertical-grain noise (semi-transparent black), as a PNG data address. */
function clothTile(): Promise<string> {
  clothTileCache ??= (async () => {
    const sharp = (await import("sharp")).default;
    const w = 256, h = 170;
    const raw = Buffer.alloc(w * h * 4);
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < w * h; i++) { raw[i * 4 + 3] = Math.round(rnd() * 46); }
    const png = await sharp(raw, { raw: { width: w, height: h, channels: 4 } }).resize(256, 256, { kernel: "cubic" }).blur(0.5).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  })();
  return clothTileCache;
}


async function buildTextures(spec: MockupSpec, dims: BookDims, front: Buffer | null, avg: Rgb, bold: TextFont, regular: TextFont, wrap: WrapCrops | null): Promise<Built> {
  const defs: string[] = [];
  const hardcover = spec.format === "hardcover";
  const W = Math.round(dims.w * PX), H = Math.round(dims.h * PX), T = Math.max(8, Math.round(dims.t * PX));
  const linen = LINEN_COLORS[spec.linenColor];
  const clothHex = hardcover ? (linen?.hex ?? "#22345f") : "#000";
  const cloth = hardcover ? hexToRgb(clothHex) : avg;
  const spineBg = hardcover ? clothHex : hex(backColourFrom(avg));
  const spineRgb = hardcover ? cloth : backColourFrom(avg);
  const ink = inkFor(spineRgb);
  const foil = hardcover ? foilPaint(spec.foilColor, defs) : null;
  const gloss = spec.finish === "G";
  // The artwork that is sent to Lulu (the author's own wrap or the site's), used for every cover, Hardcover included. On a Hardcover
  // the artwork covers the whole front board; the cloth colour only shows on the spine joints, the board edges and the page-block ends.
  const useWrap = !!wrap;
  const jpegImage = (buf: Buffer, w: number, h: number) => {
    const b64 = buf.toString("base64");
    return `<image x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/jpeg;base64,${b64}" href="data:image/jpeg;base64,${b64}"/>`;
  };

  // Linen texture: one small pre-made noise tile used as a pattern (a live noise filter on every large panel is far slower).
  const tile = hardcover ? await clothTile() : "";
  const clothId = nextId("linen");
  if (hardcover) defs.push(`<pattern id="${clothId}" width="256" height="256" patternUnits="userSpaceOnUse"><image width="256" height="256" xlink:href="${tile}" href="${tile}"/></pattern>`);
  const clothOverlay = (w: number, h: number) => `<rect width="${w}" height="${h}" fill="url(#${clothId})"/>`;

  // ---- front ----
  let frontSvg = "";
  const hinge = `<rect x="${PX * 0.2}" width="3" height="${H}" fill="#000" opacity="0.18"/><rect x="${PX * 0.2 + 3}" width="2" height="${H}" fill="#fff" opacity="0.12"/>`;
  if (useWrap && wrap) {
    frontSvg = `${jpegImage(wrap.front, W, H)}${hinge}`;
  } else if (front) {
    const b64 = front.toString("base64");
    frontSvg = `<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/jpeg;base64,${b64}" href="data:image/jpeg;base64,${b64}"/>${hinge}`;
  } else {
    frontSvg = `<rect width="${W}" height="${H}" fill="${spineBg}"/>`;
    const lines = bold.wrap(spec.title, 40, W - 90, 4);
    let y = H * 0.35;
    for (const l of lines) { frontSvg += `<path d="${bold.path(l, 40, (W - bold.width(l, 40)) / 2, y)}" fill="${ink}"/>`; y += 52; }
  }
  if (hardcover && foil && (front || wrap)) {
    // Foil lettering is stamped on top of the artwork, as it is on the real book.
    const titleLines = bold.wrap(spec.foilTitle || spec.title, 44, W - 110, 4);
    let y = H * 0.3;
    for (const line of titleLines) {
      const x = (W - bold.width(line, 44)) / 2;
      frontSvg += `<path d="${bold.path(line, 44, x + 1.2, y + 1.2)}" fill="#000" opacity="0.35"/><path d="${bold.path(line, 44, x, y)}" fill="${foil}"/>`;
      y += 58;
    }
    const foilAuthor = spec.foilAuthor || spec.author;
    if (foilAuthor) {
      const a = bold.wrap(foilAuthor, 28, W - 120, 2);
      let ay = H * 0.82;
      for (const line of a) {
        const x = (W - bold.width(line, 28)) / 2;
        frontSvg += `<path d="${bold.path(line, 28, x + 1, ay + 1)}" fill="#000" opacity="0.35"/><path d="${bold.path(line, 28, x, ay)}" fill="${foil}"/>`;
        ay += 36;
      }
    }
  }
  if (gloss) {
    const gid = nextId("gloss");
    defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.38"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.04"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="0.8" stop-color="#fff" stop-opacity="0.12"/><stop offset="1" stop-color="#fff" stop-opacity="0.02"/></linearGradient>`);
    frontSvg += `<rect width="${W}" height="${H}" fill="url(#${gid})"/>`;
  }
  if (hardcover) frontSvg += `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="3"/>`;

  // ---- back ----
  const backBg = hardcover ? clothHex : spineBg;
  const backInk = inkFor(hardcover ? cloth : spineRgb);
  let backSvg = `<rect width="${W}" height="${H}" fill="${backBg}"/>`;
  if (hardcover) backSvg += clothOverlay(W, H);
  if (useWrap && wrap) {
    backSvg = jpegImage(wrap.back, W, H);
  } else {
    let by = 120;
    const titleLines = bold.wrap(spec.title, 30, W - 110, 3);
    for (const l of titleLines) { backSvg += `<path d="${bold.path(l, 30, 55, by)}" fill="${backInk}"/>`; by += 38; }
    by += 14;
    // The description, justified inside the same safe margins as the print file (half an inch of 6-inch-wide pages).
    const m = W * (0.5 / trimInches(spec.trimCode).w);
    const lay = layoutBackDescription({ text: spec.description || "", boxW: W - 2 * m, boxH: H - by - m, unitsPerInch: W / trimInches(spec.trimCode).w, width: (t, sz) => regular.width(t, sz) });
    for (const line of lay.lines) for (const w of line.words) backSvg += `<path d="${regular.path(w.text, lay.size, m + w.x, by + line.baseline)}" fill="${backInk}" opacity="0.92"/>`;
  }
  if (hardcover) backSvg += `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" fill="none" stroke="#000" stroke-opacity="0.22" stroke-width="3"/>`;
  if (gloss && !hardcover) {
    const gid = nextId("gloss");
    defs.push(`<linearGradient id="${gid}" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.08"/></linearGradient>`);
    backSvg += `<rect width="${W}" height="${H}" fill="url(#${gid})"/>`;
  }

  // ---- spine (text runs top to bottom) ----
  let spineSvg = useWrap && wrap ? jpegImage(wrap.spine, T, H) : `<rect width="${T}" height="${H}" fill="${spineBg}"/>`;
  if (hardcover) {
    // Cloth shows along the two joints of the spine only; the real spine artwork stays between them.
    const joint = Math.max(4, Math.round(T * 0.07));
    for (const x of [0, T - joint]) spineSvg += `<rect x="${x}" width="${joint}" height="${H}" fill="${clothHex}"/><rect x="${x}" width="${joint}" height="${H}" fill="url(#${clothId})"/>`;
  }
  const sid = nextId("round");
  defs.push(`<linearGradient id="${sid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="${hardcover ? 0.34 : 0.2}"/><stop offset="0.25" stop-color="#fff" stop-opacity="0.1"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.04"/><stop offset="1" stop-color="#000" stop-opacity="${hardcover ? 0.34 : 0.2}"/></linearGradient>`);
  const spineInk = hardcover ? (foil ?? ink) : ink;
  // Printed covers already carry their own spine writing. A cloth hardcover (or a cover without any artwork) is lettered here
  // with the same plan as the print cover: nothing on a thin spine, otherwise the author at the top and the title below.
  if (!useWrap) {
    const plan = planSpineText({
      spine: T, length: H, unitsPerInch: PX,
      title: hardcover ? spec.foilTitle || spec.title : spec.title,
      author: hardcover ? spec.foilAuthor || spec.author : spec.author,
      width: (text, size) => bold.width(text, size),
    });
    for (const line of plan?.lines ?? []) {
      spineSvg += `<g transform="translate(${T / 2 + line.size * 0.35} ${line.start}) rotate(90)"><path d="${bold.path(line.text, line.size, 0, 0)}" fill="${spineInk}"/></g>`;
    }
  }
  spineSvg += `<rect width="${T}" height="${H}" fill="url(#${sid})"/>`;

  // ---- page edges ----
  const edge = (w: number, h: number, vertical: boolean): string => {
    if (!hardcover) return pagesEdge(w, h, vertical);
    // Boards (cloth) at both outer ends, pages recessed between them.
    const board = Math.min(10, Math.round((vertical ? w : h) * 0.3));
    const clothRect = (x: number, y: number, ww: number, hh: number) => `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${clothHex}"/>`;
    const inset = vertical
      ? `<rect x="${board}" width="${w - 2 * board}" height="${h}" fill="#000" opacity="0.18"/>`
      : `<rect y="${board}" width="${w}" height="${h - 2 * board}" fill="#000" opacity="0.18"/>`;
    const boards = vertical ? clothRect(0, 0, board, h) + clothRect(w - board, 0, board, h) : clothRect(0, 0, w, board) + clothRect(0, h - board, w, board);
    const pages = vertical
      ? `<svg x="${board}" y="0" width="${w - 2 * board}" height="${h}" viewBox="0 0 ${w - 2 * board} ${h}">${pagesEdge(w - 2 * board, h, true)}</svg>`
      : `<svg x="0" y="${board}" width="${w}" height="${h - 2 * board}" viewBox="0 0 ${w} ${h - 2 * board}">${pagesEdge(w, h - 2 * board, false)}</svg>`;
    return pages + inset + boards;
  };

  // Rounded cover corners (a little rounder on a paperback than on a hardcover board).
  const radius = hardcover ? 3 : 5;
  const rounded = (svg: string): string => {
    const id = nextId("rc");
    return `<defs><clipPath id="${id}"><rect width="${W}" height="${H}" rx="${radius}" ry="${radius}"/></clipPath></defs><g clip-path="url(#${id})">${svg}</g>`;
  };
  const tex: TextureSet = {
    front: { w: W, h: H, svg: rounded(frontSvg) },
    back: { w: W, h: H, svg: rounded(backSvg) },
    spine: { w: T, h: H, svg: spineSvg },
    foreEdge: { w: T, h: H, svg: edge(T, H, true) },
    top: { w: W, h: T, svg: edge(W, T, false) },
    bottom: { w: W, h: T, svg: edge(W, T, false) },
  };
  return { tex, defs };
}

function hexToRgb(h: string): Rgb {
  const n = parseInt(h.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Makes the picture. `frontImage` is the author's front cover (any picture format); null draws a plain placeholder. */
export async function renderPrintMockup(spec: MockupSpec, frontImage: Buffer | null, wrap: WrapCrops | null = null, opts: { backdrop?: boolean } = {}): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const dims = bookDimensions(spec);
  const [bold, regular] = await Promise.all([loadFont("Arimo_700Bold.ttf"), loadFont("Arimo_400Regular.ttf")]);

  let front: Buffer | null = null;
  let avg: Rgb = { r: 120, g: 110, b: 150 };
  if (frontImage) {
    const W = Math.round(dims.w * PX), H = Math.round(dims.h * PX);
    try {
      // Fit the artwork to the cover's shape, then keep it as a modest JPEG so the scene stays light.
      front = await sharp(frontImage).rotate().resize({ width: W * 2, height: H * 2, fit: "cover", position: "centre" }).jpeg({ quality: 88 }).toBuffer();
      const px = await sharp(frontImage).resize(1, 1).removeAlpha().raw().toBuffer();
      avg = { r: px[0] ?? 120, g: px[1] ?? 110, b: px[2] ?? 150 };
    } catch {
      throw new WrapError("The front cover image could not be read as a picture. Please upload it again as a JPG or PNG.");
    }
  }

  const built = await buildTextures(spec, dims, front, avg, bold, regular, wrap);
  const base = { dims, tex: built.tex };
  const placements = standardScene(base, base);
  const sceneOpts = { width: OUT_W, height: OUT_H, margin: 0.025, backdrop: opts.backdrop === true, reflection: false, reserveBottom: 0 };
  // The mockups carry no ground shadows (the book sits cleanly on the page).
  const svg = composeScene(placements, { ...sceneOpts, defs: built.defs.join("\n"), shadows: false });
  return sharp(Buffer.from(svg), { density: 72 }).png().toBuffer();
}

/** The same picture on a plain light background (for promotions). */
export async function onLightBackground(png: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(png).flatten({ background: "#f4f4f6" }).png().toBuffer();
}

/** A smaller WebP for the product page and the saved copy. */
export async function mockupWebp(png: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(png).webp({ quality: 90 }).toBuffer();
}

export { esc as escapeXml };
