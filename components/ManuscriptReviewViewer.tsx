"use client";

import { useEffect, useRef, useState } from "react";

type ManuscriptFormat = "pdf" | "epub" | "mobi" | "unknown";

/** Sniffs the real file format from its actual bytes rather than
 * trusting the URL's extension or the server's reported Content-Type —
 * both can be wrong (a DOCX converted server-side to PDF still has a
 * ".pdf" URL already, but a MIME type reported as "application/
 * octet-stream" by some upload paths would otherwise be unreadable
 * here). PDF starts with the literal "%PDF"; EPUB is just a ZIP archive
 * (signature "PK"); MOBI/AZW files carry the literal "BOOKMOBI" (or the
 * older "TEXtREAd") identifier at a fixed offset in their header — this
 * is the standard way every MOBI-aware tool recognizes the format. */
function detectFormat(buf: ArrayBuffer): ManuscriptFormat {
  const bytes = new Uint8Array(buf);
  const ascii = (start: number, len: number) => {
    if (bytes.length < start + len) return "";
    let s = "";
    for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[start + i]);
    return s;
  };
  if (ascii(0, 4) === "%PDF") return "pdf";
  if (bytes.length >= 68 && (ascii(60, 8) === "BOOKMOBI" || ascii(60, 8) === "TEXtREAd")) return "mobi";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "epub";
  return "unknown";
}

/**
 * Renders an uploaded manuscript for inline, read-only preview —
 * detects the real format (PDF / EPUB / MOBI) from the file's own
 * bytes and renders each appropriately:
 *  - PDF: page-by-page onto canvases via pdf.js (unchanged from
 *    before) — not an <iframe>/<embed>, which would show the browser's
 *    own native PDF toolbar (download, print, open in new tab).
 *  - EPUB: a real, lightweight client-side render via epub.js (a zip-
 *    based format — epub.js parses and paginates it directly in the
 *    browser, no server-side conversion needed).
 *  - MOBI: MOBI is a legacy, largely proprietary Kindle format with no
 *    maintained pure-JS renderer comparable to epub.js or pdf.js.
 *    Rather than fake a broken inline preview, this shows an honest
 *    "preview not available in-browser for this format" message with a
 *    direct open/download fallback — see the MOBI branch below.
 *
 * Used two ways: the full manuscript for editor/admin review (spread
 * mode — two PDF pages side by side, paginated) and the public "Read
 * sample" (`maxPages` set) — which, for a PDF, renders every one of
 * those first `maxPages` pages at once, stacked in a scrollable column.
 * For EPUB, "sample" caps navigation to the first couple of chapters
 * instead of a literal page count, since EPUB pagination is relative to
 * viewport size, not a fixed, countable page the way a PDF's is.
 * Right-click is disabled on the PDF canvas as a further deterrent (not
 * a hard security boundary — someone determined could still get the
 * file via browser devtools — but there's no download/print/save
 * control anywhere in the viewer's own UI).
 */
export function ManuscriptReviewViewer({ url, title, maxPages, spread, theme, scale }: { url: string; title: string; maxPages?: number; spread?: boolean; theme?: "admin" | "light"; scale?: number }) {
  const resolvedTheme = theme ?? (spread ? "admin" : "light");
  const isAdminTheme = resolvedTheme === "admin";
  const sampleMode = !!maxPages && !spread;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<ManuscriptFormat | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);

  // Fetch the file once, up front, and sniff its real format from the
  // bytes — shared by every branch below instead of each one re-
  // fetching (and re-detecting) the same file.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setFormat(null);
      setFileBuffer(null);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Couldn't load the file (${res.status}).`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        setFileBuffer(buf);
        setFormat(detectFormat(buf));
      } catch {
        if (!cancelled) setError("Couldn't open this file for inline preview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return <p style={{ fontSize: 13, color: isAdminTheme ? "var(--admin-text-faint)" : "var(--ink-faint)" }}>Loading manuscript…</p>;
  }
  if (error) {
    return <p style={{ fontSize: 13, color: "var(--coral-deep)" }}>{error}</p>;
  }
  if (!fileBuffer || !format) return null;

  if (format === "pdf") {
    return <PdfManuscriptView buffer={fileBuffer} title={title} maxPages={maxPages} spread={spread} isAdminTheme={isAdminTheme} scale={scale} />;
  }
  if (format === "epub") {
    return <EpubManuscriptView buffer={fileBuffer} title={title} sampleMode={sampleMode} isAdminTheme={isAdminTheme} />;
  }
  if (format === "mobi") {
    return <MobiFallbackView url={url} isAdminTheme={isAdminTheme} />;
  }
  return (
    <p style={{ fontSize: 13, color: "var(--coral-deep)" }}>
      Couldn&apos;t recognize this file as a PDF, EPUB, or MOBI — it may be corrupted or an unsupported format.
    </p>
  );
}

/** MOBI: no reliable, maintained pure-JS renderer exists for this
 * legacy format (unlike EPUB, which is just a parseable ZIP). Rather
 * than pretend to render it — or silently fail with a confusing error
 * — this is upfront about the limitation and offers the one honest
 * alternative: open/download the real file directly. */
function MobiFallbackView({ url, isAdminTheme }: { url: string; isAdminTheme: boolean }) {
  return (
    <div
      style={{
        padding: 24, borderRadius: 10, textAlign: "center",
        background: isAdminTheme ? "var(--admin-panel)" : "var(--cream)",
      }}
    >
      <p style={{ fontSize: 13.5, color: isAdminTheme ? "var(--admin-text)" : "var(--ink)", marginBottom: 10 }}>
        Preview not available in-browser for this format (MOBI) — download to view.
      </p>
      <p style={{ fontSize: 12, color: isAdminTheme ? "var(--admin-text-faint)" : "var(--ink-faint)", marginBottom: 14 }}>
        MOBI is a legacy Kindle format with no reliable in-browser renderer — PDF and EPUB manuscripts preview
        fully above; this file itself isn&apos;t affected and can still be downloaded and opened in any e-reader
        that supports MOBI (e.g. Kindle).
      </p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-small">
        Open / download file
      </a>
    </div>
  );
}

/** EPUB rendering via epub.js — a real, lightweight client-side reader.
 * Paginates to fit its container and exposes prev/next navigation; a
 * true page count isn't a meaningful concept for reflowable EPUB
 * content the way it is for a fixed-layout PDF, so this shows a
 * section/chapter position instead of a page number. In sample mode,
 * navigation is capped to the first couple of spine sections so "Read
 * sample" shows only an excerpt rather than the whole book. */
function EpubManuscriptView({ buffer, title, sampleMode, isAdminTheme }: { buffer: ArrayBuffer; title: string; sampleMode: boolean; isAdminTheme: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- epub.js's own types are loosely typed (Book/Rendition are effectively `any` across versions)
  const renditionRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [sectionCount, setSectionCount] = useState<number | null>(null);

  const SAMPLE_SECTION_CAP = 2; // first 3 spine sections (0, 1, 2) for "Read sample"
  const atSampleLimit = sampleMode && sectionIndex >= SAMPLE_SECTION_CAP;

  useEffect(() => {
    let cancelled = false;
    let rendition: unknown;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const ePubModule = await import("epubjs");
        const ePub = ePubModule.default;
        const book = ePub(buffer.slice(0));
        await book.ready;
        if (cancelled || !containerRef.current) return;
        const r = book.renderTo(containerRef.current, { width: "100%", height: "100%", flow: "paginated", spread: "none" });
        renditionRef.current = r;
        rendition = r;
        const spineLen = (book.spine as unknown as { length: number }).length ?? null;
        setSectionCount(spineLen);
        r.on("relocated", (location: { start: { index: number } }) => {
          setSectionIndex(location.start.index);
        });
        await r.display();
      } catch {
        if (!cancelled) setError("Couldn't open this EPUB file for inline preview — it may be corrupted.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      try {
        (rendition as { destroy?: () => void } | undefined)?.destroy?.();
      } catch {
        // Best-effort teardown only.
      }
    };
  }, [buffer]);

  function goNext() {
    if (sampleMode && sectionIndex >= SAMPLE_SECTION_CAP) return;
    renditionRef.current?.next?.();
  }
  function goPrev() {
    renditionRef.current?.prev?.();
  }

  return (
    <div>
      {loading && <p style={{ fontSize: 13, color: isAdminTheme ? "var(--admin-text-faint)" : "var(--ink-faint)" }}>Loading manuscript…</p>}
      {error && <p style={{ fontSize: 13, color: "var(--coral-deep)" }}>{error}</p>}
      <div
        ref={containerRef}
        aria-label={`${title} — EPUB preview`}
        style={{
          height: "70vh", maxWidth: 520, margin: "0 auto",
          background: isAdminTheme ? "var(--admin-panel)" : "#fff",
          borderRadius: 10, overflow: "hidden",
          border: isAdminTheme ? "1px solid var(--admin-border)" : "1px solid var(--line)",
          visibility: loading || error ? "hidden" : "visible",
        }}
      />
      {!loading && !error && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary btn-small" onClick={goPrev}>← Prev</button>
          <span style={{ fontSize: 12.5, color: isAdminTheme ? "var(--admin-text-faint)" : "var(--ink-faint)" }}>
            Section {sectionIndex + 1}{sectionCount ? ` / ${sectionCount}` : ""}
          </span>
          <button type="button" className="btn btn-primary btn-small" disabled={atSampleLimit} onClick={goNext}>Next →</button>
        </div>
      )}
      {sampleMode && !loading && !error && (
        <p style={{ fontSize: 12, color: "var(--ink-faint)", margin: "10px 0 0", textAlign: "center" }}>
          Showing an excerpt of this book — EPUB pagination doesn&apos;t map to fixed page numbers the way a PDF&apos;s does.
        </p>
      )}
    </div>
  );
}

/** PDF rendering — unchanged from before: pdf.js onto canvases, either
 * paginated one-or-two-at-a-time (full review) or stacked for the
 * first `maxPages` pages at once (sample). */
function PdfManuscriptView({ buffer, title, maxPages, spread, isAdminTheme, scale }: { buffer: ArrayBuffer; title: string; maxPages?: number; spread?: boolean; isAdminTheme: boolean; scale?: number }) {
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
        const doc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(maxPages ? Math.min(doc.numPages, maxPages) : doc.numPages);
        setPageNum(1);
      } catch {
        if (!cancelled) setError("Couldn't open this PDF file for inline preview — it may be corrupted.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [buffer, maxPages]);

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
