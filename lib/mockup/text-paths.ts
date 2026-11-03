import { readBundledFont } from "@/lib/pdf-fonts";

/**
 * Text as vector outlines. The mockup is drawn on the server, and a server has no fonts installed, so text
 * can't be left for the image engine to draw. We read our own bundled open-licence font files (Arimo, SIL Open Font
 * Licence) with fontkit and turn each letter into a path.
 */

interface FkGlyph { path: { transform(a: number, b: number, c: number, d: number, e: number, f: number): { toSVG(): string } }; advanceWidth: number }
interface FkFont { unitsPerEm: number; layout(text: string): { glyphs: FkGlyph[]; positions: { xAdvance: number; xOffset: number }[] } }

const cache = new Map<string, FkFont>();

export async function loadFont(file: "Arimo_700Bold.ttf" | "Arimo_400Regular.ttf"): Promise<TextFont> {
  let f = cache.get(file);
  if (!f) {
    const fontkit = (await import("@pdf-lib/fontkit")).default as unknown as { create(b: Uint8Array): FkFont };
    f = fontkit.create(await readBundledFont(file));
    cache.set(file, f);
  }
  return new TextFont(f);
}

export class TextFont {
  constructor(private readonly f: FkFont) {}

  /** Width of the text in pixels at this size. */
  width(text: string, size: number): number {
    const run = this.f.layout(text);
    return run.positions.reduce((s, p) => s + p.xAdvance, 0) * (size / this.f.unitsPerEm);
  }

  /** The outline of the text, starting at x with its baseline at y, as the `d` of an SVG path. */
  path(text: string, size: number, x: number, y: number): string {
    const run = this.f.layout(text);
    const k = size / this.f.unitsPerEm;
    let cx = 0;
    const parts: string[] = [];
    run.glyphs.forEach((g, i) => {
      const pos = run.positions[i];
      parts.push(g.path.transform(k, 0, 0, -k, x + (cx + pos.xOffset) * k, y).toSVG());
      cx += pos.xAdvance;
    });
    return parts.join(" ");
  }

  /** Breaks text into lines no wider than maxWidth. A single word wider than the line is kept whole. */
  wrap(text: string, size: number, maxWidth: number, maxLines: number): string[] {
    const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (line && this.width(next, size) > maxWidth) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      kept[maxLines - 1] = kept[maxLines - 1].replace(/[\s.,;:!?-]*$/, "") + "…";
      return kept;
    }
    return lines;
  }
}
