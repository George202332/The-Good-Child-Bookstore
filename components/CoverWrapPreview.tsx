"use client";

import { useEffect, useState } from "react";
import { buildEan13Bars } from "@/lib/ean13-barcode";
import {
  PALETTES, MOTIFS, hashStr, deriveBackCoverPalette, extractDominantColor,
  motifSvgInner, fitDescriptionText, wrapTextToLines, computeCoverGeometry,
} from "@/lib/cover-preview";

/**
 * The print cover-wrap preview — ported directly from the original
 * site's real print-preview engine (computeBookPreviewGeometry() /
 * renderBookPreview() in the-good-child-bookstore_54_1.html), not an
 * approximation: real trim/bleed/margin/spine dimensions from the
 * selected trim size + paper bulk + page count, the same seeded
 * palette-and-motif selection, the same solid back-cover/spine color
 * (using a real extracted dominant color once a front cover image is
 * uploaded, same as the original's canvas-based color quantization),
 * and the same guide colors/styles (Margin dashed orange, Bleed solid
 * blue, Trim solid black, Folds dashed magenta at both spine edges).
 *
 * Text-fitting uses the original's own documented canvas-unavailable
 * fallback (a deterministic character-width approximation) rather than
 * live canvas measurement, so server and client render identically and
 * never mismatch on hydration.
 */
export function CoverWrapPreview({
  title,
  subtitle,
  authorFirstName,
  authorLastName,
  description,
  isbn,
  trimCode,
  paperCode,
  pages = 32,
  coverImageUrl,
}: {
  title: string;
  subtitle?: string;
  authorFirstName?: string;
  authorLastName?: string;
  description: string;
  isbn: string;
  trimCode: string;
  paperCode: string;
  pages?: number;
  coverImageUrl?: string;
}) {
  const [showMargin, setShowMargin] = useState(true);
  const [showBleed, setShowBleed] = useState(true);
  const [showFolds, setShowFolds] = useState(true);
  const [showTrim, setShowTrim] = useState(true);
  const [dominantColor, setDominantColor] = useState<string | undefined>(undefined);

  const hasRealCoverImage = !!coverImageUrl;

  // Real dominant-color extraction from the uploaded front cover, same
  // as the original's canvas-based color quantization — degrades
  // gracefully (falls back to the seeded palette color) if the image
  // host doesn't allow cross-origin pixel reads.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!coverImageUrl) {
        await Promise.resolve();
        if (!cancelled) setDominantColor(undefined);
        return;
      }
      try {
        const c = await extractDominantColor(coverImageUrl);
        if (!cancelled) setDominantColor(c);
      } catch {
        if (!cancelled) setDominantColor(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [coverImageUrl]);

  const toggles: { label: string; value: boolean; set: (v: boolean) => void; color: string }[] = [
    { label: "Margin", value: showMargin, set: setShowMargin, color: "#E8956B" },
    { label: "Bleed", value: showBleed, set: setShowBleed, color: "#37B7E0" },
    { label: "Folds", value: showFolds, set: setShowFolds, color: "#E24BC4" },
    { label: "Trim", value: showTrim, set: setShowTrim, color: "#222" },
  ];

  // ---- Geometry (real trim/bleed/margin/spine, U = 100 SVG units/inch) ----
  const geo = computeCoverGeometry(trimCode, paperCode, pages);
  const U = 100;
  const bleed = geo.bleedIn * U, margin = geo.marginIn * U, spineW = geo.spineWidthIn * U;
  const trimW = geo.trimWidthIn * U, trimH = geo.trimHeightIn * U;
  const totalW = bleed * 2 + trimW * 2 + spineW;
  const totalH = bleed * 2 + trimH;
  const backX = bleed, spineX = bleed + trimW, frontX = bleed + trimW + spineW;

  // ---- Seeded palette + motif (same hash as the original) ----
  const seed = hashStr(title || "preview");
  const palette = PALETTES[seed % PALETTES.length];
  const back = deriveBackCoverPalette(palette, dominantColor);
  const motif = MOTIFS[seed % MOTIFS.length];

  const authorName = `${authorFirstName || ""} ${authorLastName || ""}`.trim();

  // ---- Back cover: description text + barcode, bottom-left of the safe area ----
  const boxX = backX + margin, boxY = bleed + margin;
  const boxW = trimW - margin * 2;
  const barcodeDisplayW = 180 * 0.62, barcodeDisplayH = 122.4 * 0.62;
  const barcodeGap = 12;
  const barcodeY = bleed + trimH - margin - barcodeDisplayH;
  const textAreaH = barcodeY - barcodeGap - boxY;
  const fit = fitDescriptionText(
    description || "Add a book description above to see it appear here automatically.",
    boxW, Math.max(20, textAreaH), 11.5, 7
  );
  const { bars: barcodeBars, digits: barcodeDigits } = buildEan13Bars(isbn || "");
  const barcodeUnit = barcodeDisplayW / 95;
  const barcodeBarH = barcodeDisplayH * 0.75, barcodeTallBarH = barcodeDisplayH * 0.85;

  // ---- Spine ----
  const spineColor = back.spine;
  const showSpineText = spineW > 14;

  // ---- Front cover: real image if uploaded, else gradient + motif; title/subtitle/author always overlay ----
  const titleLines = wrapTextToLines((title || "").toUpperCase(), Math.floor(trimW / 13), 3);
  const gradId = `bp-front-gradient-${seed}`;

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

      {/* Preview is centered, and sized so the book panel itself renders
          at a true 6in height (a real CSS physical-length unit) — width
          follows automatically from the real trim/spine geometry below. */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg viewBox={`0 0 ${totalW} ${totalH}`} style={{ height: "6in", width: "auto", maxWidth: "100%", background: "#fff" }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={palette[0]} />
              <stop offset="1" stopColor={palette[1]} />
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={totalW} height={totalH} fill="#fff" />

          {/* Back cover */}
          <g>
            <rect x={backX} y={bleed} width={trimW} height={trimH} fill={back.background} />
            <text fontFamily="Georgia, 'Times New Roman', serif" fontSize={fit.fontSize} fill="#fff">
              {fit.lines.map((l, i) => (
                <tspan key={i} x={boxX} y={boxY + fit.fontSize + i * fit.lineHeight}>{l}</tspan>
              ))}
            </text>
            {barcodeDigits && (
              <g transform={`translate(${boxX},${barcodeY})`}>
                <rect x={0} y={0} width={barcodeDisplayW} height={barcodeDisplayH} fill="#fff" />
                {barcodeBars.map((b, i) => (
                  <rect key={i} x={b.x * barcodeUnit} y={0} width={barcodeUnit} height={b.tall ? barcodeTallBarH : barcodeBarH} fill="#000" />
                ))}
                <text x={barcodeDisplayW / 2} y={barcodeDisplayH - 3} fontFamily="monospace" fontSize={barcodeDisplayH * 0.12} textAnchor="middle" fill="#000" letterSpacing={1.5}>
                  {barcodeDigits}
                </text>
              </g>
            )}
          </g>

          {/* Spine */}
          <g>
            <rect x={spineX} y={bleed} width={spineW} height={trimH} fill={spineColor} />
            {showSpineText && (
              <text
                x={spineX + spineW / 2} y={bleed + trimH / 2}
                fontFamily="Georgia, serif" fontWeight={700} fontSize={13} fill="#fff" textAnchor="middle"
                transform={`rotate(90 ${spineX + spineW / 2} ${bleed + trimH / 2})`}
              >
                {(title || "").slice(0, 40)}
              </text>
            )}
          </g>

          {/* Front cover */}
          <g>
            {hasRealCoverImage ? (
              <image href={coverImageUrl} x={frontX} y={bleed} width={trimW} height={trimH} preserveAspectRatio="xMidYMid slice" />
            ) : (
              <>
                <rect x={frontX} y={bleed} width={trimW} height={trimH} fill={`url(#${gradId})`} />
                <g
                  transform={`translate(${frontX + trimW / 2},${bleed + trimH * 0.55}) scale(${trimW / 110})`}
                  opacity={0.92}
                  dangerouslySetInnerHTML={{ __html: motifSvgInner(motif, "rgba(255,255,255,0.88)") }}
                />
              </>
            )}
            <text fontFamily="Georgia, 'Times New Roman', serif" fontWeight={700} fontSize={Math.max(14, trimW / 11)} fill="#fff" textAnchor="middle">
              {titleLines.map((l, i) => (
                <tspan key={i} x={frontX + trimW / 2} y={bleed + 40 + i * (trimW / 9)}>{l}</tspan>
              ))}
            </text>
            {subtitle && (
              <text
                x={frontX + trimW / 2} y={bleed + 40 + titleLines.length * (trimW / 9) + 18}
                fontFamily="Georgia, serif" fontSize={12} fill="#fff" textAnchor="middle" opacity={0.9}
              >
                {subtitle}
              </text>
            )}
            <text
              x={frontX + trimW / 2} y={bleed + trimH - 24}
              fontFamily="Georgia, serif" fontWeight={700} fontSize={Math.max(12, trimW / 16)} fill="#fff" textAnchor="middle"
            >
              {authorName.toUpperCase()}
            </text>
          </g>

          {/* Guides */}
          {showMargin && (
            <>
              <rect x={backX + margin} y={bleed + margin} width={trimW - margin * 2} height={trimH - margin * 2} fill="none" stroke="#E8956B" strokeWidth={1.5} strokeDasharray="4 3" />
              <rect x={frontX + margin} y={bleed + margin} width={trimW - margin * 2} height={trimH - margin * 2} fill="none" stroke="#E8956B" strokeWidth={1.5} strokeDasharray="4 3" />
            </>
          )}
          {showBleed && (
            <rect x={1} y={1} width={totalW - 2} height={totalH - 2} fill="none" stroke="#37B7E0" strokeWidth={2} />
          )}
          {showTrim && (
            <rect x={bleed} y={bleed} width={totalW - bleed * 2} height={totalH - bleed * 2} fill="none" stroke="#111" strokeWidth={1.5} />
          )}
          {showFolds && (
            <>
              <line x1={spineX} y1={0} x2={spineX} y2={totalH} stroke="#E24BC4" strokeWidth={1.5} strokeDasharray="6 3" />
              <line x1={spineX + spineW} y1={0} x2={spineX + spineW} y2={totalH} stroke="#E24BC4" strokeWidth={1.5} strokeDasharray="6 3" />
            </>
          )}
        </svg>
      </div>
      {/* 1in of empty space below the preview, inside the card */}
      <div style={{ height: "1in" }} />
    </div>
  );
}
