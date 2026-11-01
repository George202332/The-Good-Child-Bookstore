"use client";

import { useState } from "react";
import { coverGuides, coverTemplatePdf } from "@/lib/cover-specs";
import type { CoverSpec } from "@/actions/print-specs";

/** Download Cover Template: a PDF sized exactly to this binding's full wrap, drawn from the measurements
 * above at the moment of the click, so it always matches the current page count and trim size. */
export function CoverTemplateDownload({ cover, pageCount, title }: { cover: CoverSpec; pageCount?: number; title?: string }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function download() {
    setBusy(true);
    setProblem("");
    try {
      const bytes = await coverTemplatePdf(coverGuides(cover), { title, trimLabel: `${cover.trimWIn} x ${cover.trimHIn} in`, pageCount });
      const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cover.format}-cover-template-${cover.widthIn.toFixed(2)}x${cover.heightIn.toFixed(2)}in.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setProblem("The template could not be made. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div className="specs-actions">
      <button type="button" className="btn btn-ghost btn-small" onClick={download} disabled={busy}>{busy ? "Preparing…" : "Download Cover Template"}</button>
      {problem && <span role="alert" className="specs-text" style={{ color: "var(--coral-deep)", margin: 0 }}>{problem}</span>}
    </div>
  );
}
