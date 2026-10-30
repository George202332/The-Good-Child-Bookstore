/**
 * Font embedding for print PDFs. Lulu rejects a PDF whose fonts are not stored inside it.
 *
 * Tool: pdf-lib (reads and rewrites the PDF) + @pdf-lib/fontkit (reads the font files), both
 * pure JavaScript, so this runs on Vercel with no extra programs installed. The fonts we can
 * embed are the open-licence families bundled in lib/pdf-fonts (SIL Open Font Licence 1.1, which
 * allows embedding in documents): Arimo (matches Arial / Helvetica letter widths), Tinos
 * (Times New Roman / Times) and Cousine (Courier New / Courier).
 *
 * What it can and cannot do, honestly:
 *  - A PDF that lists a font but does not contain it gives us nothing to copy. We can only embed
 *    a font that we have ourselves. So a font is one of:
 *      "auto"            we have that very font (Arimo, Tinos, Cousine): embedded without asking.
 *      "needs-approval"  we have a stand-in. For Arial / Helvetica / Times / Courier the stand-in
 *                        has identical letter widths, so the layout and page count do not move;
 *                        for any other font the shapes differ and the layout can shift. Either way
 *                        the author must approve first.
 *      "unavailable"     the font is not ours to embed (for example Calibri), is a symbol font, or is
 *                        a composite (CID) font whose glyph map we cannot rebuild. Named plainly.
 *  - Only single-byte fonts (Type 1 / TrueType) are rewritten. The page content is never touched,
 *    so text stays where it was.
 * The original upload is never changed: the fixed copy is a new file.
 */
import { readFile } from "fs/promises";
import path from "path";
import type { PDFDict, PDFDocument, PDFRef } from "pdf-lib";
import { scanFonts, type ScannedFont } from "@/lib/pdf-font-scan";

export type FontFamilyKey = "sans" | "serif" | "mono";
interface Family { label: string; psName: string; files: { regular: string; bold: string; italic: string; boldItalic: string }; serif: boolean; mono: boolean }

const FAMILIES: Record<FontFamilyKey, Family> = {
  sans: { label: "Arimo", psName: "Arimo", serif: false, mono: false, files: { regular: "Arimo_400Regular.ttf", bold: "Arimo_700Bold.ttf", italic: "Arimo_400Regular_Italic.ttf", boldItalic: "Arimo_700Bold_Italic.ttf" } },
  serif: { label: "Tinos", psName: "Tinos", serif: true, mono: false, files: { regular: "Tinos_400Regular.ttf", bold: "Tinos_700Bold.ttf", italic: "Tinos_400Regular_Italic.ttf", boldItalic: "Tinos_700Bold_Italic.ttf" } },
  mono: { label: "Cousine", psName: "Cousine", serif: false, mono: true, files: { regular: "Cousine_400Regular.ttf", bold: "Cousine_700Bold.ttf", italic: "Cousine_400Regular_Italic.ttf", boldItalic: "Cousine_700Bold_Italic.ttf" } },
};

export type FontMatch = "exact" | "metric" | "generic" | "none";

export interface FontClassification {
  match: FontMatch;
  family?: FontFamilyKey;
  bold: boolean;
  italic: boolean;
  /** Why nothing can be done, for match "none". */
  reason?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** Decides which bundled font (if any) can stand in for a font name. Pure. */
export function classifyFontName(rawName: string): FontClassification {
  const n = norm(rawName);
  const bold = /bold|black|heavy|semibold|demi/.test(n);
  const italic = /italic|oblique|kursiv/.test(n) || /(arial|helvetica|times|courier)[a-z]*it(mt|psmt)?$/.test(n);
  if (/symbol|zapfdingbats|wingdings|webdings|dingbats/.test(n)) {
    return { match: "none", bold, italic, reason: "it is a symbol font, which has no stand-in" };
  }
  if (n.startsWith("arimo")) return { match: "exact", family: "sans", bold, italic };
  if (n.startsWith("tinos")) return { match: "exact", family: "serif", bold, italic };
  if (n.startsWith("cousine")) return { match: "exact", family: "mono", bold, italic };
  if (/^(arial|helvetica|liberationsans)/.test(n)) return { match: "metric", family: "sans", bold, italic };
  if (/^(times|liberationserif)/.test(n)) return { match: "metric", family: "serif", bold, italic };
  if (/^(courier|liberationmono)/.test(n)) return { match: "metric", family: "mono", bold, italic };
  if (/mono|consolas|menlo|typewriter|code/.test(n)) return { match: "generic", family: "mono", bold, italic };
  if (/serif(?!sans)|garamond|georgia|palatino|bookman|century|cambria|minion|caslon|baskerville|didot|bodoni|constantia|sabon|cochin|charter|book/.test(n) && !/sans/.test(n)) {
    return { match: "generic", family: "serif", bold, italic };
  }
  return { match: "generic", family: "sans", bold, italic };
}

export type FontFixStatus = "auto" | "needs-approval" | "unavailable";

export interface FontFixItem {
  /** The name in the PDF. */
  name: string;
  status: FontFixStatus;
  /** The font we would embed, e.g. "Arimo Bold". */
  substitute?: string;
  /** True when the stand-in has the same letter widths, so the layout cannot move. */
  sameWidths?: boolean;
  /** Plain-language explanation for the author. */
  message: string;
}

const faceKey = (c: FontClassification): keyof Family["files"] => (c.bold && c.italic ? "boldItalic" : c.bold ? "bold" : c.italic ? "italic" : "regular");
const faceLabel = (fam: Family, c: FontClassification) => `${fam.label}${c.bold || c.italic ? " " : ""}${[c.bold && "Bold", c.italic && "Italic"].filter(Boolean).join(" ")}`;

/** What would be done about each font that is not embedded. Pure. */
export function planFontFixes(fonts: Pick<ScannedFont, "name" | "embedded" | "simple" | "subtype">[]): FontFixItem[] {
  const seen = new Set<string>();
  const out: FontFixItem[] = [];
  for (const f of fonts) {
    if (f.embedded || seen.has(f.name)) continue;
    seen.add(f.name);
    if (!f.simple) {
      out.push({ name: f.name, status: "unavailable", message: `${f.name} is a composite font and its glyphs are not in the file, so we cannot rebuild it. Re-export the PDF from the program that made it with "embed all fonts" turned on.` });
      continue;
    }
    const c = classifyFontName(f.name);
    if (c.match === "none" || !c.family) {
      out.push({ name: f.name, status: "unavailable", message: `${f.name} cannot be embedded for you: ${c.reason ?? "we do not have this font"}. Re-export the PDF with "embed all fonts" turned on.` });
      continue;
    }
    const fam = FAMILIES[c.family];
    const sub = faceLabel(fam, c);
    if (c.match === "exact") {
      out.push({ name: f.name, status: "auto", substitute: sub, sameWidths: true, message: `${f.name} is a font we have, so it was embedded for you.` });
    } else if (c.match === "metric") {
      out.push({ name: f.name, status: "needs-approval", substitute: sub, sameWidths: true, message: `We cannot get ${f.name} itself. ${sub} has exactly the same letter widths, so nothing in your layout or page count moves, but the letter shapes differ slightly.` });
    } else {
      out.push({ name: f.name, status: "needs-approval", substitute: sub, sameWidths: false, message: `We cannot get ${f.name} itself, and it is not one we may embed. The closest we have is ${sub}, but its letter shapes and widths differ, so spacing can shift and the page count could change.` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Embedding
// ---------------------------------------------------------------------------

const FONT_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "lib", "pdf-fonts");
const fileCache = new Map<string, Uint8Array>();

export async function readBundledFont(file: string): Promise<Uint8Array> {
  const hit = fileCache.get(file);
  if (hit) return hit;
  const buf = new Uint8Array(await readFile(path.join(FONT_DIR, file)));
  fileCache.set(file, buf);
  return buf;
}

export interface FontFixResult {
  bytes: Uint8Array;
  /** Fonts that were embedded, with the font used. */
  embedded: { name: string; substitute: string; sameWidths: boolean }[];
  /** Fonts that were left alone, with the reason. */
  skipped: FontFixItem[];
  /** Fonts still not embedded in the result (empty when the fix worked). */
  remaining: string[];
}

const CP1252 = (() => {
  try { return new TextDecoder("windows-1252"); } catch { return null; }
})();
function winAnsiChar(code: number): string {
  if (code < 128) return String.fromCharCode(code);
  if (!CP1252) return String.fromCharCode(code);
  return CP1252.decode(new Uint8Array([code]));
}

/**
 * Embeds the fonts that can be embedded. `approved` lists the names (as the PDF writes them) the
 * author has agreed to have replaced by a stand-in; fonts we have ourselves ("auto") need no approval.
 * The page content is untouched. The result is re-read to prove every font that was fixed is now embedded.
 */
export async function embedMissingFonts(input: Uint8Array, approved: string[] = []): Promise<FontFixResult> {
  const { PDFDocument, PDFName, PDFNumber } = await import("pdf-lib");
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const doc = await PDFDocument.load(input, { ignoreEncryption: false, updateMetadata: false });
  const fonts = await scanFonts(doc);
  const plan = planFontFixes(fonts);
  const approvedSet = new Set(approved);
  const ctx = doc.context;
  const fileRefs = new Map<string, PDFRef>();
  const embedded: FontFixResult["embedded"] = [];
  const skipped: FontFixItem[] = [];

  for (const item of plan) {
    if (item.status === "unavailable" || (item.status === "needs-approval" && !approvedSet.has(item.name))) { skipped.push(item); continue; }
    const c = classifyFontName(item.name);
    const fam = FAMILIES[c.family!];
    const file = fam.files[faceKey(c)];
    const bytes = await readBundledFont(file);
    const kit = fontkit.create(bytes) as unknown as {
      unitsPerEm: number; ascent: number; descent: number; capHeight: number; italicAngle: number;
      bbox: { minX: number; minY: number; maxX: number; maxY: number };
      glyphForCodePoint(cp: number): { advanceWidth: number };
      hasGlyphForCodePoint(cp: number): boolean;
    };
    const k = 1000 / kit.unitsPerEm;
    let fileRef = fileRefs.get(file);
    if (!fileRef) { fileRef = ctx.register(ctx.flateStream(bytes, { Length1: bytes.length })); fileRefs.set(file, fileRef); }
    const psName = `${fam.psName}-${c.bold && c.italic ? "BoldItalic" : c.bold ? "Bold" : c.italic ? "Italic" : "Regular"}`;
    const flags = 32 + (fam.mono ? 1 : 0) + (fam.serif ? 2 : 0) + (c.italic ? 64 : 0);
    const descRef = ctx.register(ctx.obj({
      Type: "FontDescriptor",
      FontName: psName,
      Flags: flags,
      FontBBox: [Math.round(kit.bbox.minX * k), Math.round(kit.bbox.minY * k), Math.round(kit.bbox.maxX * k), Math.round(kit.bbox.maxY * k)],
      ItalicAngle: kit.italicAngle || 0,
      Ascent: Math.round(kit.ascent * k),
      Descent: Math.round(kit.descent * k),
      CapHeight: Math.round((kit.capHeight || 700 / k) * k),
      StemV: c.bold ? 140 : 80,
      FontFile2: fileRef,
    }));

    for (const f of fonts) {
      if (f.embedded || !f.simple || f.name !== item.name) continue;
      const d: PDFDict = f.dict;
      d.set(PDFName.of("Subtype"), PDFName.of("TrueType"));
      d.set(PDFName.of("BaseFont"), PDFName.of(psName));
      d.set(PDFName.of("FontDescriptor"), descRef);
      // Single-byte codes are read through Windows ANSI unless the file says otherwise.
      const enc = d.get(PDFName.of("Encoding"));
      const encName = enc ? String(enc) : "";
      if (!enc || encName === "/StandardEncoding") d.set(PDFName.of("Encoding"), PDFName.of("WinAnsiEncoding"));
      if (!d.has(PDFName.of("Widths"))) {
        const widths: number[] = [];
        for (let code = 32; code <= 255; code++) {
          const ch = winAnsiChar(code);
          const cp = ch.codePointAt(0) ?? 0;
          widths.push(cp && cp !== 0xfffd && kit.hasGlyphForCodePoint(cp) ? Math.round(kit.glyphForCodePoint(cp).advanceWidth * k) : 0);
        }
        d.set(PDFName.of("FirstChar"), PDFNumber.of(32));
        d.set(PDFName.of("LastChar"), PDFNumber.of(255));
        d.set(PDFName.of("Widths"), ctx.obj(widths));
      }
    }
    embedded.push({ name: item.name, substitute: item.substitute ?? psName, sameWidths: item.sameWidths ?? false });
  }

  const bytes = await doc.save({ useObjectStreams: false });
  // Prove it: read the result back and list anything still not embedded.
  const check = await PDFDocument.load(bytes, { updateMetadata: false });
  const remaining = [...new Set((await scanFonts(check)).filter((f) => !f.embedded).map((f) => f.name))].sort();
  return { bytes, embedded, skipped, remaining };
}

export type { PDFDocument };
