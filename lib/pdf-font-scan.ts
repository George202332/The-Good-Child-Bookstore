/**
 * Finds every font a PDF uses (on its pages and inside the form objects those pages draw)
 * and says whether each one is embedded in the file. Used by the print file check
 * (lib/print-preflight.ts) and by the font fixer (lib/pdf-fonts.ts), so both always agree.
 *
 * A font is "embedded" when its descriptor carries the font program itself (FontFile,
 * FontFile2 or FontFile3). Type 3 fonts draw their glyphs inside the file, so they count
 * as embedded.
 */
import type { PDFDict, PDFDocument } from "pdf-lib";

export interface ScannedFont {
  /** The font dictionary itself (edited in place by the fixer). */
  dict: PDFDict;
  /** The font's name as written in the file, without a "ABCDEF+" subset prefix. */
  name: string;
  subtype: string;
  embedded: boolean;
  /** A single-byte font (Type1 / TrueType / MMType1). Composite (Type0) fonts are not. */
  simple: boolean;
}

export async function scanFonts(doc: PDFDocument): Promise<ScannedFont[]> {
  const { PDFDict: PDFDictV, PDFName, PDFRef, PDFArray, PDFStream } = await import("pdf-lib");
  const ctx = doc.context;
  const seen = new Set<string>();
  const out: ScannedFont[] = [];

  const lookupDict = (v: unknown): PDFDict | undefined => {
    const o = v instanceof PDFRef ? ctx.lookup(v) : v;
    if (o instanceof PDFDictV) return o;
    if (o instanceof PDFStream) return o.dict;
    return undefined;
  };
  const hasFontFile = (desc: PDFDict | undefined) =>
    !!desc && (desc.has(PDFName.of("FontFile")) || desc.has(PDFName.of("FontFile2")) || desc.has(PDFName.of("FontFile3")));
  const baseName = (font: PDFDict) => {
    const raw = font.get(PDFName.of("BaseFont"));
    const s = raw ? String(raw).replace(/^\//, "") : "unnamed font";
    return s.replace(/^[A-Z]{6}\+/, "");
  };

  const addFont = (font: PDFDict) => {
    const subtype = String(font.get(PDFName.of("Subtype")) ?? "").replace(/^\//, "");
    if (subtype === "Type3") { out.push({ dict: font, name: baseName(font), subtype, embedded: true, simple: false }); return; }
    if (subtype === "Type0") {
      const desc = font.get(PDFName.of("DescendantFonts"));
      const arr = desc instanceof PDFRef ? ctx.lookup(desc) : desc;
      const first = arr instanceof PDFArray ? lookupDict(arr.get(0)) : undefined;
      const fd = first ? lookupDict(first.get(PDFName.of("FontDescriptor"))) : undefined;
      out.push({ dict: font, name: baseName(font), subtype, embedded: hasFontFile(fd), simple: false });
      return;
    }
    const fd = lookupDict(font.get(PDFName.of("FontDescriptor")));
    out.push({ dict: font, name: baseName(font), subtype, embedded: hasFontFile(fd), simple: true });
  };

  const walkResources = (resources: PDFDict | undefined, depth: number) => {
    if (!resources || depth > 6) return;
    const fonts = lookupDict(resources.get(PDFName.of("Font")));
    if (fonts) {
      for (const key of fonts.keys()) {
        const raw = fonts.get(key);
        const id = raw instanceof PDFRef ? raw.toString() : `${depth}:${key}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const f = lookupDict(raw);
        if (f) addFont(f);
      }
    }
    const xobjects = lookupDict(resources.get(PDFName.of("XObject")));
    if (xobjects) {
      for (const key of xobjects.keys()) {
        const raw = xobjects.get(key);
        const id = raw instanceof PDFRef ? "x" + raw.toString() : "";
        if (id) { if (seen.has(id)) continue; seen.add(id); }
        const x = raw instanceof PDFRef ? ctx.lookup(raw) : raw;
        if (x instanceof PDFStream && String(x.dict.get(PDFName.of("Subtype"))) === "/Form") {
          walkResources(lookupDict(x.dict.get(PDFName.of("Resources"))), depth + 1);
        }
      }
    }
  };

  for (const page of doc.getPages()) walkResources(page.node.Resources(), 0);
  return out;
}
