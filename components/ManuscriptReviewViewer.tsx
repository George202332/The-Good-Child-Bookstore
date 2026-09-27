"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a PDF page-by-page onto canvases (via pdf.js) — not an
 * <iframe>/<embed>, which would show the browser's own native PDF
 * toolbar (download, print, open in new tab). Used two ways: the full
 * manuscript for editor/admin review (spread mode — two pages side by
 * side, paginated, since a whole manuscript can run far too long to
 * render all at once), and the public "Read sample" (`maxPages` set,
 * `spread` not) — which renders every one of those first `maxPages`
 * pages at once, stacked in a scrollable column, so opening the sample
 * actually shows all of it rather than landing on page 1 with a
 * pagination control the reader has to notice and use. No separate
 * sample images to manage either way — it's literally the real
 * manuscript. Right-click is also disabled on the canvas as a further
 * deterrent (not a hard security boundary — someone determined could
 * still get the file via browser devtools — but there's no
 * download/print/save control anywhere in the viewer's own UI).
 */
export function ManuscriptReviewViewer({ url, title, maxPages, spread, theme, scale }: { url: string; title: string; maxPages?: number; spread?: boolean; theme?: "admin" | "light"; scale?: number }) {
  const resolvedTheme = theme ?? (spread ? "admin" : "light");
  const isAdminTheme = resolvedTheme === "admin";
  const sampleMode = !!maxPages && !spread;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const sampleCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
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

  async function renderPage(doc: import("pdfjs-dist").PDFDocumentProxy, canvasEl: HTMLCanvasElement, targetPage: number, pageScale: number) {
    const page = await doc.getPage(targetPage);
    const viewport = page.getViewport({ scale: pageScale });
    canvasEl.width = viewport.width;
    canvasEl.height = viewport.height;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    await page.render({ canvasContext: ctx, viewport, canvas: canvasEl }).promise;
  }

  // Sample mode: render every page from 1 to numPages at once, stacked —
  // the whole point is that opening "Read sample" shows all of the first
  // maxPages pages, not just the first one behind a page-turner.
  useEffect(() => {
    if (!sampleMode) return;
    const doc = pdfDocRef.current;
    if (!doc || numPages === null) return;

    let cancelled = false;
    (async () => {
      for (let p = 1; p <= numPages; p++) {
        if (cancelled) return;
        const canvasEl = sampleCanvasRefs.current[p - 1];
        if (!canvasEl) continue;
        try {
          await renderPage(doc, canvasEl, p, scale ?? 1.3);
        } catch {
          // Skip a page that fails to render rather than aborting the
          // whole sample.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sampleMode, numPages, scale]);

  // Full-manuscript review mode (unchanged): one page — or a spread of
  // two — at a time, paginated, since these files can run far longer
  // than 10 pages.
  useEffect(() => {
    if (sampleMode) return;
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
      if (cancelled) return;
      await renderPage(doc, canvasEl, targetPage, scale ?? 1.3);
    }
    (async () => {
      await renderInto(canvasRef.current, pageNum);
      if (spread) await renderInto(canvasRef2.current, pageNum + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [sampleMode, pageNum, numPages, spread, scale]);

  return (
    <div>
      {loading && <p style={{ fontSize: 13, color: isAdminTheme ? "var(--admin-text-faint)" : "var(--ink-faint)" }}>Loading manuscript…</p>}
      {error && <p style={{ fontSize: 13, color: "var(--coral-deep)" }}>{error}</p>}
      {!loading && !error && sampleMode && (
        <div>
          {/* Fixed-height viewport: scroll-snap (see .sample-viewer-viewport
              in site.css) locks the scroll position to exactly one page at a
              time, and each page slot below is sized to that same height, so
              only one full page is ever visible — never a partial peek of
              the next one. The scrollbar is hidden but scrolling itself
              (wheel, trackpad, touch, keyboard) works completely normally. */}
          <div
            className="sample-viewer-viewport no-scrollbar"
            style={{
              height: "70vh", overflowY: "auto",
              background: "#171320", borderRadius: 10,
              maxWidth: 440, margin: "0 auto",
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {Array.from({ length: numPages ?? 0 }, (_, i) => i + 1).map((p) => (
              <div key={p} className="sample-viewer-page" style={{ height: "70vh", width: "100%", padding: "10px 0", boxSizing: "border-box" }}>
                <canvas
                  ref={(el) => { sampleCanvasRefs.current[p - 1] = el; }}
                  aria-label={`${title} — page ${p}`}
                  style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", display: "block" }}
                />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "10px 0 0", textAlign: "center" }}>
            Showing the first {numPages} page{numPages === 1 ? "" : "s"} of this book — scroll for the next page.
          </p>
        </div>
      )}
      {!loading && !error && !sampleMode && (
        <>
          <div
            style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: spread ? "2mm" : 0, background: isAdminTheme ? "var(--admin-panel)" : "var(--cream)", borderRadius: 10, padding: 16, overflow: "visible" }}
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
            <span style={{ fontSize: 12.5, color: isAdminTheme ? "var(--admin-text-faint)" : "var(--ink-faint)" }}>
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
