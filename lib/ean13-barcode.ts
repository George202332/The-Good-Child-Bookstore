/**
 * Real EAN-13 barcode encoding — ported directly from the original
 * site's buildEan13BarcodeSVG (the-good-child-bookstore_54_1.html:8474-
 * 8546), including its exact reverse-engineered proportions (180x122.4
 * base canvas, module width, quiet zone, guard-vs-data bar heights, and
 * digit-group text positions) so the on-screen barcode and both
 * downloads all match the reference design pixel-for-pixel — not an
 * approximation.
 *
 * The check digit is always recomputed from the ISBN's own first 12
 * digits (ean13CheckDigit), the same as the original, so the generated
 * barcode is guaranteed scannable even if the stored ISBN string has a
 * typo'd or placeholder final digit — the first 12 digits (the real
 * Lulu-issued prefix/registrant/title block) are what's trusted.
 */

const L_CODE = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G_CODE = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R_CODE = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** Computes the real EAN-13 check digit so a generated barcode is
 * actually scannable, even if the stored ISBN string has a typo'd or
 * placeholder check digit. */
export function ean13CheckDigit(digits12: number[]): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += digits12[i] * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** Extracts the real first 12 digits from an ISBN string and recomputes
 * a valid 13th (check) digit — returns null if there aren't even 12
 * digits to work with. */
export function isbnToEan13Digits(isbn: string): number[] | null {
  const digits = (isbn || "").replace(/[^0-9]/g, "");
  if (digits.length < 12) return null;
  const first12 = digits.slice(0, 12).split("").map(Number);
  return [...first12, ean13CheckDigit(first12)];
}

export interface Ean13Bar {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Ean13Layout {
  digits: number[];
  digitStr: string;
  canvasW: number;
  canvasH: number;
  bars: Ean13Bar[];
  /** The 3 human-readable text groups: the lone first digit, then two
   * groups of 6 — same split and positions as the reference sample. */
  textGroups: { text: string; x: number; y: number; fontSize: number }[];
}

/** Builds the exact reverse-engineered barcode layout (see the
 * original's buildEan13BarcodeSVG comment) at a given scale — used
 * identically for the on-screen preview, both downloads, and the small
 * barcode embedded in the back-cover print preview. */
export function buildEan13Layout(isbn: string, scale = 1): Ean13Layout | null {
  const digits = isbnToEan13Digits(isbn);
  if (!digits) return null;

  const moduleW = 1.2743362831858391 * scale;
  const canvasW = 180 * scale, canvasH = 122.4 * scale;
  const barsTop = 17.6 * scale;
  const guardBottom = 104 * scale, dataBottom = 87.2 * scale;
  const startX = (18 + 9 * 1.2743362831858391) * scale;

  const firstDigit = digits[0];
  const parity = PARITY[firstDigit];
  const leftDigits = digits.slice(1, 7);
  const rightDigits = digits.slice(7, 13);
  let pattern = "101";
  leftDigits.forEach((d, i) => { pattern += parity[i] === "L" ? L_CODE[d] : G_CODE[d]; });
  pattern += "01010";
  rightDigits.forEach((d) => { pattern += R_CODE[d]; });
  pattern += "101";

  let x = startX;
  const bars: Ean13Bar[] = [];
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "1") {
      const isGuard = i < 3 || (i >= 45 && i < 50) || i >= pattern.length - 3;
      const bottom = isGuard ? guardBottom : dataBottom;
      bars.push({ x, y: barsTop, width: moduleW, height: bottom - barsTop });
    }
    x += moduleW;
  }

  const digitStr = digits.join("");
  const digit1X = 19.274336283185842 * scale;
  const leftGroupX = 34.85309734513274 * scale;
  const rightGroupX = 94.74690265486724 * scale;
  const fontSize = 14 * scale;
  const textY = 101.36 * scale;

  return {
    digits, digitStr, canvasW, canvasH, bars,
    textGroups: [
      { text: digitStr[0], x: digit1X, y: textY, fontSize },
      { text: digitStr.slice(1, 7), x: leftGroupX, y: textY, fontSize },
      { text: digitStr.slice(7, 13), x: rightGroupX, y: textY, fontSize },
    ],
  };
}

/** Renders a complete barcode SVG string at the given scale — used for
 * both the SVG and PNG downloads (PNG is rasterized from this same
 * markup at a higher scale for a crisp export, matching the original's
 * downloadIsbnBarcode which downloads at scale:3). */
export function ean13ToSvgString(isbn: string, scale = 1): string {
  const layout = buildEan13Layout(isbn, scale);
  if (!layout) return "";
  const bars = layout.bars
    .map((b) => `<rect x="${b.x.toFixed(3)}" y="${b.y.toFixed(3)}" width="${b.width.toFixed(3)}" height="${b.height.toFixed(3)}" fill="#000"/>`)
    .join("");
  const texts = layout.textGroups
    .map((t) => `<text x="${t.x.toFixed(2)}" y="${t.y.toFixed(2)}" font-family="Courier, monospace" font-size="${t.fontSize.toFixed(2)}">${t.text}</text>`)
    .join("");
  return `<svg viewBox="0 0 ${layout.canvasW.toFixed(3)} ${layout.canvasH.toFixed(3)}" xmlns="http://www.w3.org/2000/svg" width="${layout.canvasW.toFixed(1)}" height="${layout.canvasH.toFixed(1)}">
    <rect x="0" y="0" width="${layout.canvasW.toFixed(3)}" height="${layout.canvasH.toFixed(3)}" fill="#fff"/>
    ${bars}
    ${texts}
  </svg>`;
}
