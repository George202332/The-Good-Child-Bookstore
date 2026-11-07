/**
 * Letter widths of Times New Roman (and Tinos, its metric-identical open-licence twin that the print files embed), in
 * thousandths of the text size, for the printable characters. The on-screen cover preview measures text with this, so the
 * lines it breaks match the lines in the print file almost exactly. The print file itself measures with the real font file.
 */
const REGULAR = "250 333 408 500 500 833 778 180 333 333 500 564 250 333 250 278 500 500 500 500 500 500 500 500 500 500 278 278 564 564 564 444 921 722 667 667 722 611 556 722 722 333 389 722 611 889 722 722 556 722 667 556 611 722 722 944 722 722 611 333 278 333 469 500 333 444 500 444 500 444 333 500 500 278 278 500 278 778 500 500 500 500 333 389 278 500 500 722 500 500 444 480 200 480 541".split(" ").map(Number);
const BOLD = "250 333 555 500 500 1000 833 278 333 333 500 570 250 333 250 278 500 500 500 500 500 500 500 500 500 500 333 333 570 570 570 500 930 722 667 722 722 667 611 778 778 389 500 778 667 944 722 778 611 778 722 556 667 722 722 1000 722 722 667 333 278 333 581 500 333 500 556 444 556 444 333 500 556 278 333 556 278 833 556 500 556 556 444 389 333 556 500 722 500 500 444 394 220 394 520".split(" ").map(Number);

/** Width of the text at this size, in the same unit as `size`. Characters outside the printable set count as a space. */
export function timesWidth(text: string, size: number, bold = false): number {
  const table = bold ? BOLD : REGULAR;
  let sum = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    sum += c >= 32 && c <= 126 ? table[c - 32] : 250;
  }
  return (sum * size) / 1000;
}
