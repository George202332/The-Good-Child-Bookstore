"use client";

import { useRef } from "react";
import { ean13ToSvgString, buildEan13Bars } from "@/lib/ean13-barcode";

/** Renders a real, scannable EAN-13 barcode from an ISBN, with working
 * Download SVG / Download PNG buttons — matches "ISBN Barcode...
 * Generated automatically from the ISBN assigned to this title." */
export function Ean13Barcode({ isbn }: { isbn: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { bars, digits } = buildEan13Bars(isbn);
  const width = 200;
  const height = 100;
  const unit = width / 95;
  const barHeight = height * 0.75;
  const tallBarHeight = height * 0.85;

  function downloadSvg() {
    const svgString = ean13ToSvgString(isbn, width, height);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `isbn-${digits}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPng() {
    const svgString = ean13ToSvgString(isbn, width * 3, height * 3);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 3;
      canvas.height = height * 3;
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
          a.download = `isbn-${digits}.png`;
          a.click();
          URL.revokeObjectURL(pngUrl);
        }, "image/png");
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width={200} height={100} style={{ background: "#fff", border: "1px solid var(--line)" }}>
        <rect x={0} y={0} width={width} height={height} fill="#fff" />
        {bars.map((b, i) => (
          <rect key={i} x={b.x * unit} y={0} width={unit} height={b.tall ? tallBarHeight : barHeight} fill="#000" />
        ))}
        <text x={width / 2} y={height - 4} fontFamily="monospace" fontSize={height * 0.12} textAnchor="middle" fill="#000" letterSpacing={2}>
          {digits}
        </text>
      </svg>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-ghost btn-small" onClick={downloadSvg}>Download SVG</button>
        <button type="button" className="btn btn-ghost btn-small" onClick={downloadPng}>Download PNG</button>
      </div>
    </div>
  );
}
