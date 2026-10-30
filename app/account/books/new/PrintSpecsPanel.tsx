"use client";

import type { FixFontsResult, PrintSpecReport } from "@/actions/print-specs";
import type { FontFixItem } from "@/lib/pdf-fonts";

const WARN = { color: "var(--coral-deep)" } as const;

/**
 * "What we read from your file": page count, page size and trim size, fonts, and the cover size
 * Lulu needs, all read from the uploaded interior PDF. Also the best-option check (the size read
 * from the file against the size selected), and the fonts step (embedding, approvals, processing state).
 */
export function PrintSpecsPanel({
  report, busy, chosenTrimCode, onUseTrim, fontBusy, fontResult, onEmbed,
}: {
  report: PrintSpecReport | null;
  busy: boolean;
  chosenTrimCode: string;
  onUseTrim: (code: string) => void;
  fontBusy: boolean;
  fontResult: FixFontsResult | null;
  /** Embed fonts, replacing the named fonts with the stand-ins the author approved. */
  onEmbed: (approved: string[]) => void;
}) {
  if (!report && !busy && !fontBusy) return null;
  const waiting: FontFixItem[] = report?.fonts?.unembedded.filter((f) => f.status === "needs-approval") ?? [];
  const blocked: FontFixItem[] = report?.fonts?.unembedded.filter((f) => f.status === "unavailable") ?? [];
  const recommendedOther = report?.recommendedTrimCode && report.recommendedTrimCode !== chosenTrimCode ? report.recommendedTrimCode : null;
  const recommendedLabel = report?.candidates?.find((c) => c.code === recommendedOther)?.label;

  return (
    <div className="form-section" style={{ background: "var(--cream)", marginTop: 14 }} aria-live="polite">
      <h3 style={{ fontSize: 16, marginBottom: 4 }}>What We Read From Your File</h3>

      {(busy || fontBusy) && (
        <p role="status" className="field-hint" style={{ fontWeight: 600 }}>
          {fontBusy
            ? "Processing: embedding fonts in a copy of your PDF. This usually takes a few seconds, and up to about half a minute for a large file. Please keep this page open."
            : "Processing: reading your file and asking Lulu about it…"}
        </p>
      )}

      {report && !report.ok && <p role="alert" className="field-hint" style={WARN}>{report.error}</p>}

      {report?.ok && (
        <>
          <table className="spec-requirement-table" style={{ marginTop: 6 }}>
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
              {report.cover && report.cover.length > 0
                ? report.cover.map((c) => (
                    <tr key={c.format}>
                      <td>{c.format === "hardcover" ? "Hardcover" : "Paperback"} cover wrap</td>
                      <td>{c.widthIn.toFixed(3)} x {c.heightIn.toFixed(3)} in, spine {c.spineIn.toFixed(3)} in</td>
                    </tr>
                  ))
                : <tr><td>Cover wrap</td><td>Lulu could not give the cover size right now. It is worked out again when you reload.</td></tr>}
            </tbody>
          </table>

          {report.unsupportedMessage && <p role="alert" className="field-hint" style={WARN}>{report.unsupportedMessage}</p>}

          {report.recommendation && !report.unsupportedMessage && (
            <div className="field-hint" role={recommendedOther ? "alert" : undefined} style={recommendedOther ? WARN : undefined}>
              <strong>Best option: </strong>{report.recommendation}
              {report.luluChecked === false && " (Lulu could not be asked, so only the site's own checks were used.)"}
              {recommendedOther && (
                <>{" "}<button type="button" className="btn btn-ghost btn-small" onClick={() => onUseTrim(recommendedOther)}>Use {recommendedLabel ?? recommendedOther}</button></>
              )}
              <div style={{ marginTop: 4 }}>You can still pick a different size with the Trim size buttons. Lulu&apos;s own check has the final word, and nothing can be published until the file passes it.</div>
            </div>
          )}

          {waiting.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p className="field-hint" style={{ fontWeight: 600 }}>Fonts that need your approval</p>
              {waiting.map((f) => (
                <p key={f.name} className="field-hint">{f.message}{" "}
                  <button type="button" className="btn btn-ghost btn-small" disabled={fontBusy} onClick={() => onEmbed([f.name])}>Embed {f.substitute} instead of {f.name}</button>
                </p>
              ))}
              {waiting.length > 1 && (
                <button type="button" className="btn btn-primary btn-small" disabled={fontBusy} onClick={() => onEmbed(waiting.map((f) => f.name))}>Approve all stand-ins</button>
              )}
            </div>
          )}

          {blocked.length > 0 && (
            <div style={{ marginTop: 10 }} role="alert">
              <p className="field-hint" style={{ ...WARN, fontWeight: 600 }}>Fonts we cannot embed for you</p>
              {blocked.map((f) => <p key={f.name} className="field-hint" style={WARN}>{f.message}</p>)}
            </div>
          )}
        </>
      )}

      {fontResult && (
        <div style={{ marginTop: 10 }} role={fontResult.ok ? "status" : "alert"}>
          {!fontResult.ok && <p className="field-hint" style={WARN}>{fontResult.error}</p>}
          {fontResult.ok && fontResult.note && fontResult.embedded.length > 0 && (
            <p className="field-hint">
              {fontResult.note}
              {fontResult.embedded.some((e) => !e.sameWidths) && " A different font was used for some text, so check the preview: spacing can differ."}
              {fontResult.pageCountBefore !== fontResult.pageCountAfter && ` The page count changed from ${fontResult.pageCountBefore} to ${fontResult.pageCountAfter}; the cover and printing cost were worked out again.`}
              {fontResult.remaining.length > 0 && ` Still not embedded: ${fontResult.remaining.join(", ")}.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
