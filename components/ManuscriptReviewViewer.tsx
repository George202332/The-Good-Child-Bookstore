"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a PDF page-by-page onto canvases (via pdf.js) — not an
 * <iframe>/<embed>, which would show the browser's own native PDF
 * toolbar (download, print, open in new tab). Used two ways: the full
 * manuscript for editor/admin review (spread mode — two pages side by
 * side, no download option anywhere in the UI), and the public "Read
 * sample" (single page, capped to the first `maxPages` pages of that
 * same manuscript file — no separate sample images to manage, it's
 * literally the real manuscript). Right-click is also disabled on the
 * canvas as a further deterrent (not a hard security boundary —
 * someone determined could still get the file via browser devtools —
 * but there's no download/print/save control anywhere in the viewer's
 * own UI).
 */
export function ManuscriptReviewViewer({ url, title, maxPages, spread }: { url: string; title: string; maxPages?: number; spread?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const step = spread ? 2 : 1;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const doc = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(maxPages ? Math.min(doc.numPages, maxPages) : doc.numPages);
        setPageNum(1);
      } catch {
        if (!cancelled) setError("Couldn't open this file for inline preview — it's likely an EPUB or MOBI file, which this viewer doesn't support yet (only PDF).");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [url, maxPages]);

  useEffect(() => {
    const doc = pdfDocRef.current;
    if (!doc || numPages === null) return;

    let cancelled = false;
    async function renderInto(canvasEl: HTMLCanvasElement | null, targetPage: number) {
      if (!canvasEl || !doc || targetPage < 1 || (numPages !== null && targetPage > numPages)) {
        if (canvasEl) {
          const ctx = canvasEl.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        }
        return;
      }
      const page = await doc.getPage(targetPage);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1.3 });
      canvasEl.width = viewport.width;
      canvasEl.height = viewport.height;
      const ctx = canvasEl.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport, canvas: canvasEl }).promise;
    }
    (async () => {
      await renderInto(canvasRef.current, pageNum);
      if (spread) await renderInto(canvasRef2.current, pageNum + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNum, numPages, spread]);

  return (
    <div>
      {loading && <p style={{ fontSize: 13, color: spread ? "var(--admin-text-faint)" : "var(--ink-faint)" }}>Loading manuscript…</p>}
      {error && <p style={{ fontSize: 13, color: "var(--coral-deep)" }}>{error}</p>}
      {!loading && !error && (
        <>
          <div
            style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: spread ? "2mm" : 0, background: spread ? "var(--admin-panel)" : "var(--cream)", borderRadius: 10, padding: 16, overflow: "auto", maxHeight: "75vh" }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <canvas ref={canvasRef} aria-label={`${title} — page ${pageNum}`} style={{ maxWidth: spread ? "49%" : "100%", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }} />
            {spread && (
              <canvas ref={canvasRef2} aria-label={`${title} — page ${pageNum + 1}`} style={{ maxWidth: "49%", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }} />
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary btn-small" disabled={pageNum <= 1} onClick={() => setPageNum(1)}>First</button>
            <button type="button" className="btn btn-primary btn-small" disabled={pageNum <= 1} onClick={() => setPageNum((p) => Math.max(1, p - step))}>← Prev</button>
            <input
              type="number"
              className="field"
              style={{ width: 70, textAlign: "center", margin: 0, padding: "8px 6px" }}
              min={1}
              max={numPages ?? 1}
              value={pageNum}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 1 && numPages && v <= numPages) setPageNum(v);
              }}
            />
            <span style={{ fontSize: 12.5, color: spread ? "var(--admin-text-faint)" : "var(--ink-faint)" }}>
              {spread ? `– ${Math.min(pageNum + 1, numPages ?? pageNum)}` : ""} / {numPages}
            </span>
            <button type="button" className="btn btn-primary btn-small" disabled={numPages === null || pageNum + step - 1 >= numPages} onClick={() => setPageNum((p) => Math.min(numPages ?? p, p + step))}>Next →</button>
            <button type="button" className="btn btn-primary btn-small" disabled={numPages === null || pageNum + step - 1 >= numPages} onClick={() => setPageNum(numPages ? Math.max(1, numPages - step + 1) : 1)}>Last</button>
          </div>
        </>
      )}
    </div>
  );
}
