"use client";

import { buildEan13Layout, ean13ToSvgString } from "@/lib/ean13-barcode";

/** Renders a real, scannable EAN-13 barcode from an ISBN — ported from
 * the original's exact reverse-engineered proportions (180x122.4 base
 * canvas, guard bars taller than data bars, the digit split into a lone
 * first digit plus two groups of 6, precisely positioned to match the
 * reference sample) — matches "ISBN Barcode... Generated automatically
 * from the ISBN assigned to this title." Download SVG / Download PNG
 * both work off this same layout, downloaded at 3x scale for a crisp
 * export (same as the original's downloadIsbnBarcode). */
export function Ean13Barcode({ isbn }: { isbn: string }) {
  const layout = buildEan13Layout(isbn, 1);

  function downloadSvg() {
    if (!layout) return;
    const svgString = ean13ToSvgString(isbn, 3);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `isbn-${layout.digitStr}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPng() {
    if (!layout) return;
    const svgString = ean13ToSvgString(isbn, 3);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const scaledLayout = buildEan13Layout(isbn, 3);
      const canvas = document.createElement("canvas");
      canvas.width = scaledLayout?.canvasW ?? img.width;
      canvas.height = scaledLayout?.canvasH ?? img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = pngUrl;
          a.download = `isbn-${layout.digitStr}.png`;
          a.click();
          URL.revokeObjectURL(pngUrl);
        }, "image/png");
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  if (!layout) {
    return <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>Enter a valid ISBN (at least 12 digits) to generate a barcode.</p>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg viewBox={`0 0 ${layout.canvasW} ${layout.canvasH}`} width={220} height={220 * (layout.canvasH / layout.canvasW)} style={{ background: "#fff", border: "1px solid var(--line)" }}>
        <rect x={0} y={0} width={layout.canvasW} height={layout.canvasH} fill="#fff" />
        {layout.bars.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.width} height={b.height} fill="#000" />
        ))}
        {layout.textGroups.map((t, i) => (
          <text key={i} x={t.x} y={t.y} fontFamily="Courier, monospace" fontSize={t.fontSize}>{t.text}</text>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-ghost btn-small" onClick={downloadSvg}>Download SVG</button>
        <button type="button" className="btn btn-ghost btn-small" onClick={downloadPng}>Download PNG</button>
      </div>
    </div>
  );
}
