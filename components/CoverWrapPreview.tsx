"use client";

import { useEffect, useState } from "react";
import { layoutBackDescription, backWordCount, backWordsOver, BACK_DESCRIPTION_MAX_WORDS } from "@/lib/back-cover";
import { planSpineText, SPINE_CENTRE_K } from "@/lib/spine-text";
import { timesWidth } from "@/lib/times-widths";
import {
  PALETTES, MOTIFS, hashStr, deriveBackCoverPalette, extractDominantColor,
  motifSvgInner, computeCoverGeometry,
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
/** Times New Roman, falling back to its metric twin and then any serif. */
const SERIF = "'Times New Roman', Tinos, 'Liberation Serif', Times, serif";

export function CoverWrapPreview({
  title,
  authorFirstName,
  authorLastName,
  description,
  trimCode,
  paperCode,
  pages = 32,
  coverImageUrl,
  customCoverFileId,
}: {
  title: string;
  /** Kept so existing callers still compile; nothing is drawn over the front cover. */
  subtitle?: string;
  authorFirstName?: string;
  authorLastName?: string;
  description: string;
  trimCode: string;
  paperCode: string;
  pages?: number;
  coverImageUrl?: string;
  /** When set, the author's own uploaded full-wrap cover PDF (front, spine,
   * back) is shown here instead of the generated cover, under the same
   * Margin / Bleed / Folds / Trim guides. */
  customCoverFileId?: string;
}) {
  const [showMargin, setShowMargin] = useState(true);
  const [showBleed, setShowBleed] = useState(true);
  const [showFolds, setShowFolds] = useState(true);
  const [showTrim, setShowTrim] = useState(true);
  const [dominantColor, setDominantColor] = useState<string | undefined>(undefined);

  const hasRealCoverImage = !!coverImageUrl;

  // The author's own full-wrap cover: its first page is drawn to an image
  // so it can sit in the very same preview, under the very same guides.
  const [custom, setCustom] = useState<{ url: string; wIn: number; hIn: number } | null>(null);
  const [customState, setCustomState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!customCoverFileId) {
        await Promise.resolve();
        if (!cancelled) { setCustom(null); setCustomState("idle"); }
        return;
      }
      await Promise.resolve();
      if (!cancelled) setCustomState("loading");
      try {
        const res = await fetch(`/api/files/${customCoverFileId}`);
        if (!res.ok) throw new Error("fetch");
        const buffer = await res.arrayBuffer();
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        const page = await doc.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(3, 2000 / base.width) });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (!cancelled) {
          setCustom({ url: canvas.toDataURL("image/jpeg", 0.88), wIn: base.width / 72, hIn: base.height / 72 });
          setCustomState("idle");
        }
      } catch {
        if (!cancelled) { setCustom(null); setCustomState("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [customCoverFileId]);

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
    { label: "Margin", value: showMargin, set: setShowMargin, color: "#D9743F" },
    { label: "Bleed", value: showBleed, set: setShowBleed, color: "#37B7E0" },
    { label: "Folds", value: showFolds, set: setShowFolds, color: "#E24BC4" },
    { label: "Trim", value: showTrim, set: setShowTrim, color: "#222" },
  ];

  // ---- Geometry (real trim/bleed/margin/spine, U = 100 SVG units/inch) ----
  const geo = computeCoverGeometry(trimCode, paperCode, pages);
  const U = 100;
  // With a custom cover the spine is whatever that file actually has.
  const customSpineIn = custom ? custom.wIn - geo.trimWidthIn * 2 - geo.bleedIn * 2 : null;
  const useCustom = !!custom && customSpineIn !== null && customSpineIn >= 0;
  const bleed = geo.bleedIn * U, margin = geo.marginIn * U, spineW = (useCustom ? (customSpineIn as number) : geo.spineWidthIn) * U;
  const trimW = geo.trimWidthIn * U, trimH = geo.trimHeightIn * U;
  const expectedW = geo.trimWidthIn * 2 + geo.spineWidthIn + geo.bleedIn * 2;
  const expectedH = geo.trimHeightIn + geo.bleedIn * 2;
  const customMismatch = !!custom && (Math.abs(custom.wIn - expectedW) > 0.1 || Math.abs(custom.hIn - expectedH) > 0.1);
  const totalW = bleed * 2 + trimW * 2 + spineW;
  const totalH = bleed * 2 + trimH;
  const backX = bleed, spineX = bleed + trimW, frontX = bleed + trimW + spineW;

  // ---- Seeded palette + motif (same hash as the original) ----
  const seed = hashStr(title || "preview");
  const palette = PALETTES[seed % PALETTES.length];
  const back = deriveBackCoverPalette(palette, dominantColor);
  const motif = MOTIFS[seed % MOTIFS.length];

  // ---- Back cover: the description, left-aligned at 11 points (10 at the smallest), inside the safe area from margin to margin (same layout as the print file) ----
  const boxX = backX + margin, boxY = bleed + margin;
  const boxW = trimW - margin * 2;
  const boxH = trimH - margin * 2;
  const backLayout = layoutBackDescription({
    text: description || "Add a book description above to see it appear here automatically.",
    boxW, boxH, unitsPerInch: U,
    // Times New Roman letter widths (the print file embeds Tinos, which has the same widths), so the lines break where the print file's do.
    width: (text, size) => timesWidth(text, size, false),
  });
  const descWords = backWordCount(description);
  const descOver = backWordsOver(description);

  // ---- Spine ----
  const spineColor = back.spine;
  const spinePlan = useCustom ? null : planSpineText({
    spine: spineW, length: trimH, unitsPerInch: U, pages, title, author: `${authorFirstName ?? ""} ${authorLastName ?? ""}`,
    // Times New Roman Bold letter widths (the print file embeds Tinos, which has the same widths).
    width: (text, size) => timesWidth(text, size, true),
  });
  const spineTextColor = (() => {
    const m = /^#?([0-9a-f]{6})$/i.exec(spineColor);
    if (!m) return "#fff";
    const n = parseInt(m[1], 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.55 ? "#17171c" : "#fff";
  })();

  // ---- Front cover: the real image if uploaded, else a plain gradient + motif. Nothing is written over it. ----
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

      {customCoverFileId && customState === "loading" && (
        <p className="field-hint" role="status">Loading your custom cover…</p>
      )}
      {customCoverFileId && customState === "error" && (
        <p className="field-hint" role="alert" style={{ color: "var(--coral-deep)" }}>
          Your custom cover couldn&apos;t be shown here (the file may be damaged). The generated cover is shown instead; upload the PDF again to retry.
        </p>
      )}
      {useCustom && custom && (
        <p className="field-hint" style={customMismatch ? { color: "var(--coral-deep)" } : undefined}>
          {customMismatch
            ? `Showing your custom cover (${custom.wIn.toFixed(2)} × ${custom.hIn.toFixed(2)} in). For this trim size and page count a full wrap is about ${expectedW.toFixed(2)} × ${expectedH.toFixed(2)} in — check the guides below before submitting.`
            : "Showing your custom cover. Check that your artwork sits inside the dashed Margin lines and that the fold lines match your spine."}
        </p>
      )}

      {!useCustom && spinePlan?.notice && (
        <p className="field-hint" role="status" style={{ color: "var(--coral-deep)" }}>{spinePlan.notice}</p>
      )}
      {!useCustom && descOver > 0 && (
        <p className="field-hint" role="status" style={{ color: "var(--coral-deep)" }}>
          Your description is {descWords} words. The back cover holds about {BACK_DESCRIPTION_MAX_WORDS}, so {descOver} {descOver === 1 ? "word is" : "words are"} over and the end is cut off on the printed cover. Shorten it to print it all.
        </p>
      )}
      {!useCustom && descOver === 0 && descWords > 0 && (
        <p className="field-hint">Back cover description: {descWords} of about {BACK_DESCRIPTION_MAX_WORDS} words.</p>
      )}

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

          {useCustom && custom && (
            <image href={custom.url} x={0} y={0} width={totalW} height={totalH} preserveAspectRatio="none" />
          )}

          {/* Back cover */}
          {!useCustom && <g>
            <rect x={backX} y={bleed} width={trimW} height={trimH} fill={back.background} />
            {backLayout.lines.map((line, i) => (
              <text key={i} fontFamily={SERIF} fontSize={backLayout.size} fill={spineTextColor}>
                {line.words.map((w, j) => (
                  <tspan key={j} x={boxX + w.x} y={boxY + line.baseline}>{w.text}</tspan>
                ))}
              </text>
            ))}
          </g>}

          {/* Spine */}
          {!useCustom && <g>
            <rect x={spineX} y={bleed} width={spineW} height={trimH} fill={spineColor} />
            {spinePlan && spinePlan.lines.map((line, i) => (
              // Same plan as the print cover and the 3D mockups: author at the top end, title lower toward the bottom end, nothing on a thin spine.
              <text
                key={i}
                x={spineX + spineW / 2 - line.size * SPINE_CENTRE_K} y={bleed + line.start}
                fontFamily={SERIF} fontWeight={700} fontSize={line.size} fill={spineTextColor}
                transform={`rotate(90 ${spineX + spineW / 2 - line.size * SPINE_CENTRE_K} ${bleed + line.start})`}
              >
                {line.text}
              </text>
            ))}
          </g>}

          {/* Front cover */}
          {!useCustom && <g>
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
          </g>}

          {/* Guides */}
          {showMargin && (
            <>
              <rect x={backX + margin} y={bleed + margin} width={trimW - margin * 2} height={trimH - margin * 2} fill="none" stroke="#D9743F" strokeWidth={1.5} strokeDasharray="4 3" />
              <rect x={frontX + margin} y={bleed + margin} width={trimW - margin * 2} height={trimH - margin * 2} fill="none" stroke="#D9743F" strokeWidth={1.5} strokeDasharray="4 3" />
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
