"use client";

import { coverGuides, coverTemplateSvg } from "@/lib/cover-specs";
import type { CoverSpec } from "@/actions/print-specs";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download Cover Template: a guide drawn at the exact wrap size Lulu gave for this book (SVG, or a 150 dpi PNG). */
export function CoverTemplateDownload({ cover, pageCount }: { cover: CoverSpec; pageCount?: number }) {
  const g = coverGuides(cover);
  const base = `${cover.format}-cover-template-${cover.widthIn.toFixed(2)}x${cover.heightIn.toFixed(2)}in`;
  const svg = () => coverTemplateSvg(g, pageCount);

  const downloadSvg = () => save(new Blob([svg()], { type: "image/svg+xml" }), `${base}.svg`);
  const downloadPng = () => {
    const dpi = 150;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(cover.widthIn * dpi);
      canvas.height = Math.round(cover.heightIn * dpi);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => { if (b) save(b, `${base}.png`); }, "image/png");
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg())}`;
  };

  return (
    <div className="specs-actions">
      <button type="button" className="btn btn-ghost btn-small" onClick={downloadSvg}>Download Cover Template (SVG)</button>
      <button type="button" className="btn btn-ghost btn-small" onClick={downloadPng}>Download Cover Template (PNG)</button>
    </div>
  );
}
