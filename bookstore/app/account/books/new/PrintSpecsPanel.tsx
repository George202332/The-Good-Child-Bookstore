"use client";

import type { FixFontsResult, PrintSpecReport } from "@/actions/print-specs";
import type { FontFixItem } from "@/lib/pdf-fonts";
import { coverGuides } from "@/lib/cover-specs";
import { CoverTemplateDownload } from "./CoverTemplateDownload";

const WARN = { color: "var(--coral-deep)" } as const;

/**
 * "What we read from your file": page count, page size and trim size, fonts, and the cover size
 * Lulu needs, all read from the uploaded interior PDF. Also the best-option check (the size read
 * from the file against the size selected), and the fonts step (embedding, approvals, processing state).
 */
export function PrintSpecsPanel({
  report, busy, chosenTrimCode, onUseTrim, fontBusy, fontResult, title,
}: {
  report: PrintSpecReport | null;
  busy: boolean;
  chosenTrimCode: string;
  onUseTrim: (code: string) => void;
  fontBusy: boolean;
  fontResult: FixFontsResult | null;
  /** The book title, printed in the cover template header. */
  title?: string;
}) {
  if (!report && !busy && !fontBusy) return null;
  const blocked: FontFixItem[] = report?.fonts?.unembedded.filter((f) => f.status === "unavailable") ?? [];
  const recommendedOther = report?.recommendedTrimCode && report.recommendedTrimCode !== chosenTrimCode ? report.recommendedTrimCode : null;
  const recommendedLabel = report?.candidates?.find((c) => c.code === recommendedOther)?.label;

  return (
    <div className="form-section specs-panel" style={{ background: "var(--cream)", marginTop: 14 }} aria-live="polite">
      <h3 className="specs-title">What We Read From Your File</h3>

      {(busy || fontBusy) && (
        <p role="status" className="specs-text" style={{ fontWeight: 600 }}>
          {fontBusy
            ? "Embedding the fonts in a copy of your PDF. This usually takes a few seconds, and up to about half a minute for a large file. Please keep this page open. Your file is checked again by itself afterwards."
            : "Processing: reading your file and asking Lulu about it…"}
        </p>
      )}

      {report && !report.ok && <p role="alert" className="specs-text" style={WARN}>{report.error}</p>}

      {report?.ok && (
        <>
          <table className="spec-requirement-table">
            <tbody>
              <tr><td>Pages</td><td>{report.pageCount}</td></tr>
              <tr><td>Page size</td><td>{report.pageSizeLabel}</td></tr>
              <tr><td>Trim size</td><td>{report.detectedTrim ? `${report.detectedTrim.label}${report.detectedTrim.withBleed ? " (the file includes bleed)" : ""}` : "Not a size Lulu prints"}</td></tr>
              <tr>
                <td>Fonts</td>
                <td>
                  {report.fonts && report.fonts.unembedded.length === 0
                    ? `All ${report.fonts.total} embedded`
                    : `${report.fonts?.unembedded.length ?? 0} of ${report.fonts?.total ?? 0} not embedded: ${report.fonts?.unembedded.map((f) => f.name).join(", ")}`}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="specs-block">
            <h4 className="specs-subtitle">Cover Dimensions</h4>
            <p className="specs-text">Design your full wraparound cover (back, spine and front in one page) at exactly these sizes. They follow your page count and trim size, and update by themselves when either changes.</p>
            {report.cover && report.cover.length > 0 ? report.cover.map((c) => {
              const g = coverGuides(c);
              return (
                <div key={c.format} className="specs-cover">
                  <h5 className="specs-cover-title">{c.format === "hardcover" ? "Hardcover" : "Paperback"} Cover Wrap</h5>
                  <table className="spec-requirement-table">
                    <tbody>
                      <tr><td>Total width</td><td>{c.widthIn.toFixed(3)} in</td></tr>
                      <tr><td>Total height</td><td>{c.heightIn.toFixed(3)} in</td></tr>
                      <tr><td>Spine width</td><td>{c.spineIn.toFixed(3)} in</td></tr>
                      <tr><td>Each cover panel (trim)</td><td>{c.trimWIn.toFixed(3)} x {c.trimHIn.toFixed(3)} in</td></tr>
                      <tr><td>{g.wrapIn > 0 ? "Bleed and wrap, every side" : "Bleed, every side"}</td><td>{g.outerIn.toFixed(3)} in{g.wrapIn > 0 ? ` (${g.bleedIn.toFixed(3)} in bleed + ${g.wrapIn.toFixed(3)} in wrap)` : ""}</td></tr>
                      <tr><td>Safe margin</td><td>Keep text {g.safeIn} in inside the trim edge</td></tr>
                    </tbody>
                  </table>
                  <CoverTemplateDownload cover={c} pageCount={report.pageCount} title={title} />
                </div>
              );
            }) : <p className="specs-text">Lulu could not give the cover size right now. It is worked out again when you reload.</p>}
            <table className="spec-requirement-table">
              <tbody>
                <tr><td>Resolution</td><td>300 DPI minimum</td></tr>
                <tr><td>Colour</td><td>CMYK recommended</td></tr>
                <tr><td>Format</td><td>PDF only, one page, up to 4 MB</td></tr>
              </tbody>
            </table>
            <p className="specs-text">If you upload your own cover, we check it against these exact sizes straight away and tell you what is off, before Lulu&apos;s final check.</p>
          </div>

          {report.unsupportedMessage && <p role="alert" className="specs-text" style={WARN}>{report.unsupportedMessage}</p>}

          {report.recommendation && !report.unsupportedMessage && (
            <div className="specs-block specs-text" role={recommendedOther ? "alert" : undefined} style={recommendedOther ? WARN : undefined}>
              <strong>Best option: </strong>{report.recommendation}
              {report.luluChecked === false && " (Lulu could not be asked, so only the site's own checks were used.)"}
              {recommendedOther && (
                <div className="specs-actions"><button type="button" className="btn btn-ghost btn-small" onClick={() => onUseTrim(recommendedOther)}>Use {recommendedLabel ?? recommendedOther}</button></div>
              )}
              <div className="specs-note">You can still pick a different size with the Trim size buttons. Lulu&apos;s own check has the final word, and nothing can be published until the file passes it.</div>
            </div>
          )}

          {blocked.length > 0 && (
            <div className="specs-block" role="alert">
              <h4 className="specs-subtitle" style={WARN}>Fonts We Cannot Embed For You</h4>
              {blocked.map((f) => <p key={f.name} className="specs-text" style={WARN}>{f.message}</p>)}
            </div>
          )}
        </>
      )}

      {fontResult && (
        <div className="specs-block" role={fontResult.ok ? "status" : "alert"}>
          {!fontResult.ok && <p className="specs-text" style={WARN}>{fontResult.error}</p>}
          {fontResult.ok && fontResult.note && fontResult.embedded.length > 0 && (
            <p className="specs-text">
              {fontResult.note}
              {fontResult.remaining.length > 0 && ` Still not embedded: ${fontResult.remaining.join(", ")}.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
