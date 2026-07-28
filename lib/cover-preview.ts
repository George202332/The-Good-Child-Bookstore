/**
 * Ported directly from the original file's real print cover-wrap preview
 * engine (the-good-child-bookstore_54_1.html: computeBookPreviewGeometry
 * ~9433, renderBookPreview ~9529, plus its color/text helpers) so the
 * React version renders the identical geometry, colors, and layout —
 * not an approximation. Kept in one module since every piece
 * (hash → palette → motif, geometry, guides) is small and tightly coupled.
 */

// ---------- Palette + motif selection (hashStr → PALETTES/MOTIFS) ----------

export const PALETTES: [string, string][] = [
  ["#F0A6C0", "#EF87AC"], ["#8FD3B3", "#6DBE97"], ["#B7A0E8", "#9A7EDD"],
  ["#F4B942", "#E2A22B"], ["#FF8C6B", "#F06E49"], ["#7FC4E0", "#57ABCE"],
  ["#E8A0C7", "#D67FAF"], ["#A7D98C", "#8AC46B"], ["#F7C873", "#EDA93E"],
  ["#9FB6E8", "#7C98DB"], ["#F29CA3", "#E5747E"], ["#7ED6C1", "#4FBEA5"],
];

/** Only the motif key (3rd field) of the original's 50-entry TITLES
 * catalog matters for the cover preview — the demo title/author names
 * in that array are used elsewhere (catalog seeding) and don't apply
 * here, so just the motif sequence is kept, in the same order. */
export const MOTIFS: string[] = [
  "fox", "moon", "boat", "sun", "cloud", "umbrella", "balloon", "owl", "train", "leaf",
  "dragon", "cat", "leaf", "boat", "rainbow", "star", "heart", "tree", "balloon", "cloud",
  "tree", "boat", "moon", "star", "leaf", "moon", "boat", "sun", "balloon", "leaf",
  "tree", "star", "dragon", "cloud", "heart", "umbrella", "fox", "balloon", "cat", "train",
  "leaf", "dragon", "owl", "rainbow", "tree", "boat", "star", "moon", "heart", "leaf",
];

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function darkenHexColor(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const num = parseInt(c, 16);
  let r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const num = parseInt(c, 16);
  const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** A single flat, solid color used identically for both the back cover
 * and the spine — a plain, clean wraparound, not a mirror of the front
 * artwork. Uses the real extracted dominant color from an uploaded front
 * cover when available; only darkens it if needed for text contrast. */
export function deriveBackCoverPalette(frontPalette: [string, string], dominantColor?: string) {
  const baseColor = dominantColor || frontPalette[0];
  const solid = relativeLuminance(baseColor) > 0.6 ? darkenHexColor(baseColor, 0.3) : baseColor;
  return { background: solid, spine: solid };
}

/** Downsamples an uploaded cover image onto a small canvas and buckets
 * pixel colors into a coarse histogram, returning the most frequent
 * bucket's representative color — skips near-white/near-black pixels so
 * the page's white margin or ink doesn't win over the actual artwork. */
export function extractDominantColor(dataUrlOrImageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve("#8FD3B3"); return; }
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        const buckets: Record<string, { count: number; r: number; g: number; b: number }> = {};
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          if (max > 235 && min > 220) continue;
          if (max < 25) continue;
          const key = `${r >> 5},${g >> 5},${b >> 5}`;
          if (!buckets[key]) buckets[key] = { count: 0, r: 0, g: 0, b: 0 };
          buckets[key].count++; buckets[key].r += r; buckets[key].g += g; buckets[key].b += b;
        }
        let best: { count: number; r: number; g: number; b: number } | null = null;
        Object.values(buckets).forEach((b) => { if (!best || b.count > best.count) best = b; });
        if (!best) { resolve("#8FD3B3"); return; }
        const { count, r: rs, g: gs, b: bs } = best;
        const r = Math.round(rs / count), g = Math.round(gs / count), b = Math.round(bs / count);
        resolve("#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = dataUrlOrImageUrl;
  });
}

// ---------- Motif shapes (ported verbatim) ----------

export function motifSvgInner(kind: string, color: string): string {
  const c = color || "#fff";
  const shapes: Record<string, string> = {
    sun: `<circle cx="50" cy="50" r="20" fill="${c}"/>${Array.from({ length: 8 }).map((_, i) => { const a = i * 45 * Math.PI / 180; const x1 = 50 + 28 * Math.cos(a), y1 = 50 + 28 * Math.sin(a), x2 = 50 + 40 * Math.cos(a), y2 = 50 + 40 * Math.sin(a); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`; }).join("")}`,
    moon: `<path d="M60 20 A32 32 0 1 0 60 84 A24 24 0 1 1 60 20Z" fill="${c}"/><circle cx="70" cy="30" r="3" fill="${c}"/><circle cx="80" cy="45" r="2" fill="${c}"/>`,
    leaf: `<path d="M50 15 C75 20 85 45 85 65 C60 65 40 55 35 30 C40 20 45 16 50 15Z" fill="${c}"/><path d="M50 20 C50 40 55 55 78 62" stroke="rgba(0,0,0,0.15)" stroke-width="3" fill="none"/>`,
    star: `<path d="M50 8 L61 38 L94 38 L67 57 L78 88 L50 68 L22 88 L33 57 L6 38 L39 38Z" fill="${c}"/>`,
    balloon: `<ellipse cx="50" cy="40" rx="26" ry="32" fill="${c}"/><path d="M50 72 L44 84 L56 84Z" fill="${c}"/><line x1="50" y1="84" x2="50" y2="100" stroke="${c}" stroke-width="2"/>`,
    cat: `<path d="M30 40 L22 18 L42 32Z" fill="${c}"/><path d="M70 40 L78 18 L58 32Z" fill="${c}"/><circle cx="50" cy="55" r="30" fill="${c}"/>`,
    fox: `<path d="M50 30 C70 30 82 50 78 75 C70 90 55 92 50 92 C45 92 30 90 22 75 C18 50 30 30 50 30Z" fill="${c}"/><path d="M28 32 L18 12 L40 26Z" fill="${c}"/><path d="M72 32 L82 12 L60 26Z" fill="${c}"/>`,
    boat: `<path d="M18 60 L82 60 L70 82 L30 82Z" fill="${c}"/><line x1="50" y1="15" x2="50" y2="60" stroke="${c}" stroke-width="4"/><path d="M50 18 L78 55 L50 55Z" fill="${c}"/>`,
    rainbow: `<path d="M15 75 A35 35 0 0 1 85 75" stroke="${c}" stroke-width="9" fill="none"/><path d="M28 75 A22 22 0 0 1 72 75" stroke="${c}" stroke-width="9" fill="none" opacity="0.6"/>`,
    tree: `<circle cx="50" cy="35" r="28" fill="${c}"/><rect x="44" y="55" width="12" height="35" rx="3" fill="${c}"/>`,
    owl: `<ellipse cx="50" cy="55" rx="32" ry="36" fill="${c}"/><circle cx="38" cy="45" r="10" fill="#fff" opacity="0.85"/><circle cx="62" cy="45" r="10" fill="#fff" opacity="0.85"/><circle cx="38" cy="45" r="4" fill="${c}"/><circle cx="62" cy="45" r="4" fill="${c}"/><path d="M50 55 L44 65 L56 65Z" fill="#F4B942"/>`,
    dragon: `<path d="M20 70 Q35 30 60 35 Q85 40 80 65 Q60 55 55 70 Q45 60 20 70Z" fill="${c}"/><circle cx="70" cy="42" r="4" fill="#fff"/>`,
    cloud: `<ellipse cx="35" cy="55" rx="20" ry="16" fill="${c}"/><ellipse cx="58" cy="45" rx="26" ry="22" fill="${c}"/><ellipse cx="78" cy="58" rx="16" ry="13" fill="${c}"/>`,
    umbrella: `<path d="M15 50 A35 35 0 0 1 85 50Z" fill="${c}"/><line x1="50" y1="50" x2="50" y2="90" stroke="${c}" stroke-width="4"/><path d="M50 90 Q58 90 58 82" stroke="${c}" stroke-width="4" fill="none"/>`,
    train: `<rect x="15" y="35" width="70" height="35" rx="8" fill="${c}"/><circle cx="30" cy="78" r="7" fill="${c}"/><circle cx="70" cy="78" r="7" fill="${c}"/><rect x="25" y="45" width="18" height="14" fill="#fff" opacity="0.6"/><rect x="55" y="45" width="18" height="14" fill="#fff" opacity="0.6"/>`,
    heart: `<path d="M50 85 C10 60 15 25 40 25 C48 25 50 32 50 32 C50 32 52 25 60 25 C85 25 90 60 50 85Z" fill="${c}"/>`,
  };
  return shapes[kind] || shapes.star;
}

// ---------- Text wrapping (deterministic fallback — no canvas, so
// server and client render identically and never mismatch on hydrate;
// this is the same fallback path the original ships when canvas
// measurement is unavailable). ----------

function approxTextWidth(text: string, fontSize: number): number {
  return (text || "").length * fontSize * 0.5;
}

function wrapTextByWidth(text: string, boxWidthPx: number, fontSize: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((w) => {
    const candidate = line ? line + " " + w : w;
    if (approxTextWidth(candidate, fontSize) > boxWidthPx && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

export function fitDescriptionText(
  text: string, boxWidthPx: number, boxHeightPx: number, maxFontSize: number, minFontSize: number
): { fontSize: number; lines: string[]; lineHeight: number } {
  let fontSize = maxFontSize;
  let lines: string[] = [];
  while (fontSize >= minFontSize) {
    const lineHeight = fontSize * 1.15;
    lines = wrapTextByWidth(text, boxWidthPx, fontSize);
    if (lines.length * lineHeight <= boxHeightPx) return { fontSize, lines, lineHeight };
    fontSize -= 0.5;
  }
  fontSize = minFontSize;
  const lineHeight = fontSize * 1.15;
  const maxLines = Math.max(1, Math.floor(boxHeightPx / lineHeight));
  lines = wrapTextByWidth(text, boxWidthPx, fontSize);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[.,;:]?$/, "") + "…";
  }
  return { fontSize, lines, lineHeight };
}

export function wrapTextToLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxCharsPerLine) {
      lines.push(line.trim());
      line = w;
      if (lines.length >= maxLines) break;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line && lines.length < maxLines) lines.push(line.trim());
  const truncated = words.join(" ").length > lines.join(" ").length;
  if (truncated && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[.,;:]?$/, "") + "…";
  }
  return lines;
}

// ---------- Geometry (ported from computeBookPreviewGeometry) ----------

export interface CoverGeometry {
  trimWidthIn: number;
  trimHeightIn: number;
  bleedIn: number;
  marginIn: number;
  spineWidthIn: number;
}

/** Paper bulk (pages per inch) is encoded in the paper code's trailing
 * 3 digits, exactly as in estimateCoverDimensionsPt. */
export function computeCoverGeometry(trimCode: string, paperCode: string, pages: number): CoverGeometry {
  const trimWidthIn = parseInt(trimCode.slice(0, 4), 10) / 100;
  const trimHeightIn = parseInt(trimCode.slice(5, 9), 10) / 100;
  const bulkMatch = (paperCode || "").match(/(\d{3})$/);
  const pagesPerInch = bulkMatch ? parseInt(bulkMatch[1], 10) : 444;
  const spineWidthIn = (pages || 32) / pagesPerInch;
  const bleedIn = 0.125;
  const marginIn = 0.5;
  return { trimWidthIn, trimHeightIn, bleedIn, marginIn, spineWidthIn };
}
