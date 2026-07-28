"use client";

import { useState } from "react";

/**
 * The print cover-wrap preview — a back-cover/front-cover two-panel
 * spread with toggleable Margin/Bleed/Folds/Trim guide overlays, matching
 * "Use this preview window to see how your book will look. Carefully
 * review the margin, bleed, and fold areas to ensure your book will
 * print correctly."
 *
 * This renders a representative, correctly-proportioned wrap layout with
 * real toggleable guides — not yet tied to the actual uploaded cover
 * image's real dimensions/bleed (that needs the uploaded file's real
 * pixel size, which would come from a proper image-processing pass
 * server-side); it uses the book's own accent colors as a stand-in.
 */
export function CoverWrapPreview({ description, isbn, accentColor = "#8A5B6E" }: { description: string; isbn: string; accentColor?: string }) {
  const [showMargin, setShowMargin] = useState(true);
  const [showBleed, setShowBleed] = useState(true);
  const [showFolds, setShowFolds] = useState(true);
  const [showTrim, setShowTrim] = useState(true);

  const toggles: { label: string; value: boolean; set: (v: boolean) => void; color: string }[] = [
    { label: "Margin", value: showMargin, set: setShowMargin, color: "#D98254" },
    { label: "Bleed", value: showBleed, set: setShowBleed, color: "#3AA0E0" },
    { label: "Folds", value: showFolds, set: setShowFolds, color: "#D6499C" },
    { label: "Trim", value: showTrim, set: setShowTrim, color: "#1A1A1A" },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap" }}>
        {toggles.map((t) => (
          <label key={t.label} className="toggle-row" style={{ marginBottom: 0 }}>
            <span className="toggle-switch" style={{ ["--toggle-on-color" as string]: t.color }}>
              <input type="checkbox" checked={t.value} onChange={(e) => t.set(e.target.checked)} />
              <span className="toggle-slider" style={t.value ? { background: t.color } : undefined} />
            </span>
            <span>{t.label}</span>
          </label>
        ))}
      </div>

      {/* Preview is centered, and sized so the book panel itself (the
          viewBox's 380px-tall dimension) renders at a true 6in — the
          "in" unit here is a real CSS physical-length unit, not a guess.
          Width follows automatically from the SVG's own aspect ratio. */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg viewBox="0 0 760 380" style={{ height: "6in", width: "auto", maxWidth: "100%", border: "1px solid var(--line)", background: "#fff" }}>
          {/* Trim (outer cut line) */}
          {showTrim && <rect x={1} y={1} width={758} height={378} fill="none" stroke="#1A1A1A" strokeWidth={1.5} />}
          {/* Bleed (extends past trim) */}
          {showBleed && <rect x={9} y={9} width={742} height={362} fill="none" stroke="#3AA0E0" strokeWidth={1} strokeDasharray="4 3" />}

          {/* Back cover panel */}
          <rect x={2} y={2} width={378} height={376} fill={accentColor} />
          {/* Front cover panel */}
          <rect x={380} y={2} width={378} height={376} fill="#F2A6C4" />

          {/* Spine fold lines */}
          {showFolds && (
            <>
              <line x1={380} y1={0} x2={380} y2={380} stroke="#D6499C" strokeWidth={1} strokeDasharray="4 3" />
            </>
          )}

          {/* Margin guide (inner safe area) */}
          {showMargin && (
            <>
              <rect x={30} y={30} width={320} height={316} fill="none" stroke="#D98254" strokeWidth={1} strokeDasharray="3 3" />
              <rect x={410} y={30} width={320} height={316} fill="none" stroke="#D98254" strokeWidth={1} strokeDasharray="3 3" />
            </>
          )}

          {/* Back cover description placeholder */}
          <text x={40} y={48} fontSize={10} fill="rgba(255,255,255,0.85)" style={{ fontFamily: "Times New Roman, serif" }}>
            {description ? description.slice(0, 60) : "Add a book description above to see it appear here."}
          </text>

          {/* Barcode */}
          <rect x={40} y={320} width={60} height={30} fill="#fff" />
          <text x={70} y={340} fontSize={5} textAnchor="middle" fontFamily="monospace">{isbn.replace(/[^0-9]/g, "").slice(0, 13) || "0000000000000"}</text>

          {/* Decorative shapes on front cover */}
          <circle cx={700} cy={320} r={45} fill="rgba(255,255,255,0.25)" />
          <polygon points="705,300 720,330 690,330" fill="#F4B942" />
        </svg>
      </div>
      {/* 1in of empty space below the preview, inside the card */}
      <div style={{ height: "1in" }} />
    </div>
  );
}
