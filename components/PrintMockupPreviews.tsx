"use client";

import { useEffect, useRef, useState } from "react";
import { previewPrintMockup, downloadPrintMockup, type PreviewInput } from "@/actions/print-mockups";

type Common = Omit<PreviewInput, "format">;

function Card({ format, label, common, enabled }: { format: "paperback" | "hardcover"; label: string; common: Common; enabled: boolean }) {
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);
  const key = JSON.stringify(common);

  useEffect(() => {
    if (!enabled) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      const r = await previewPrintMockup({ ...common, format }).catch(() => ({ ok: false, error: "The preview could not be made." }) as const);
      if (mine !== seq.current) return;
      setBusy(false);
      if (r.ok && r.image) { setImage(r.image); setError(""); } else setError(r.error ?? "The preview could not be made.");
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, format]);

  async function download(background: "transparent" | "light") {
    setDownloading(true);
    const r = await downloadPrintMockup({ ...common, format }, background).catch(() => null);
    setDownloading(false);
    if (!r?.ok || !r.png) { setError(r?.error ?? "The download could not be made."); return; }
    const a = document.createElement("a");
    a.href = r.png.startsWith("data:") ? r.png : `data:image/png;base64,${r.png}`;
    a.download = r.fileName ?? `${label.toLowerCase()}-mockup.png`;
    a.click();
  }

  return (
    <div className="preview-card" style={{ flex: "1 1 280px", minWidth: 0 }}>
      <h3 className="preview-card-title">{label}</h3>
      <div className="preview-card-body" style={{ minHeight: 200, display: "grid", placeItems: "center" }}>
        {!enabled ? (
          <p className="preview-card-help">{label} is switched off for this book.</p>
        ) : image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`${label} mockup`} style={{ width: "100%", maxWidth: 360, height: "auto", opacity: busy ? 0.55 : 1 }} />
        ) : (
          <p className="preview-card-help">{busy ? "Making the preview…" : "The preview appears here."}</p>
        )}
      </div>
      {error && <p className="preview-card-help" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-small btn-ghost" disabled={!enabled || downloading || !image} onClick={() => download("transparent")}>
          {downloading ? "Preparing…" : "Download PNG (transparent)"}
        </button>
        <button type="button" className="btn btn-small btn-ghost" disabled={!enabled || downloading || !image} onClick={() => download("light")}>
          {downloading ? "Preparing…" : "Download PNG (light background)"}
        </button>
      </div>
    </div>
  );
}

export function PrintMockupPreviews({ common, paperbackEnabled, hardcoverEnabled }: { common: Common; paperbackEnabled: boolean; hardcoverEnabled: boolean }) {
  return (
    <div style={{ marginTop: 22 }}>
      <h3 className="specs-title" style={{ marginBottom: 6 }}>Mockup Previews</h3>
      <p className="specs-text">How your book will look as a Paperback and as a Hardcover. They update by themselves as you change the details above.</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card format="paperback" label="Paperback" common={common} enabled={paperbackEnabled} />
        <Card format="hardcover" label="Hardcover" common={common} enabled={hardcoverEnabled} />
      </div>
    </div>
  );
}
