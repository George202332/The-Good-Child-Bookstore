"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a PDF manuscript entirely as canvas images, page by page —
 * not an <iframe>/<embed>, which would show the browser's own native
 * PDF toolbar (download, print, open in new tab). This gives a real
 * read-only review pane: page navigation only, no way to save or print
 * from the viewer's own UI. Right-click is also disabled on the canvas
 * as a further deterrent (not a hard security boundary — someone
 * determined could still get the file via browser devtools — but this
 * matches "open it to review, not to download it" for the normal case).
 */
export function ManuscriptReviewViewer({ url, title }: { url: string; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);

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
        setNumPages(doc.numPages);
        setPageNum(1);
      } catch {
        if (!cancelled) setError("Couldn't open this manuscript for preview — try downloading it isn't available here; contact support if this keeps happening.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || numPages === null) return;

    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageNum);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 1.4 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [pageNum, numPages]);

  return (
    <div>
      {loading && <p style={{ fontSize: 13, color: "var(--ink-faint, var(--admin-text-faint))" }}>Loading manuscript…</p>}
      {error && <p style={{ fontSize: 13, color: "var(--coral-deep)" }}>{error}</p>}
      {!loading && !error && (
        <>
          <div
            style={{ display: "flex", justifyContent: "center", background: "var(--cream, var(--admin-panel))", borderRadius: 10, padding: 16, overflow: "auto", maxHeight: "75vh" }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <canvas ref={canvasRef} aria-label={`${title} — page ${pageNum}`} style={{ maxWidth: "100%", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <button type="button" className="btn btn-ghost btn-small" disabled={pageNum <= 1} onClick={() => setPageNum((p) => Math.max(1, p - 1))}>
              ← Previous
            </button>
            <span style={{ fontSize: 12.5, color: "var(--ink-faint, var(--admin-text-faint))" }}>
              Page {pageNum} of {numPages}
            </span>
            <button type="button" className="btn btn-ghost btn-small" disabled={numPages === null || pageNum >= numPages} onClick={() => setPageNum((p) => Math.min(numPages ?? p, p + 1))}>
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
