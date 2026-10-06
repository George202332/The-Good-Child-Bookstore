"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { validatePreviewPath } from "@/lib/preview-path";

type DeviceKey = "mobile" | "tablet" | "desktop";

const DEVICES: Record<DeviceKey, { label: string; width: number; height: number }> = {
  mobile: { label: "Mobile", width: 375, height: 812 },
  tablet: { label: "Tablet", width: 768, height: 1024 },
  desktop: { label: "Desktop", width: 1280, height: 800 },
};

const PAGES: { label: string; path: string }[] = [
  { label: "Home", path: "/" },
  { label: "Bookshelf", path: "/bookshelf" },
  { label: "Shop", path: "/shop" },
  { label: "Authorship", path: "/authors" },
  { label: "Affiliate", path: "/affiliate" },
  { label: "Blog", path: "/blog" },
  { label: "About", path: "/about" },
  { label: "Contact us", path: "/contact" },
  { label: "FAQs", path: "/faq" },
  { label: "Cart", path: "/cart" },
  { label: "Login", path: "/login" },
  { label: "Sign up", path: "/signup" },
  { label: "Privacy Policy", path: "/privacy" },
  { label: "Terms of Service", path: "/terms" },
  { label: "Returns Policy", path: "/returns" },
];

const CSS = `
.rp-wrap { display: flex; flex-direction: column; gap: 14px; }
.rp-panel { background: var(--admin-panel); border: 1px solid var(--admin-border); border-radius: 12px; padding: 14px 16px; }
.rp-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.rp-row + .rp-row { margin-top: 12px; }
.rp-seg { display: inline-flex; border: 1px solid var(--admin-border); border-radius: 8px; overflow: hidden; }
.rp-seg button { background: transparent; color: var(--admin-text-soft); border: 0; padding: 8px 16px; font-size: 13.5px; font-weight: 400; cursor: pointer; font-family: inherit; }
.rp-seg button + button { border-left: 1px solid var(--admin-border); }
.rp-seg button[aria-pressed="true"] { background: var(--admin-accent-fill); color: #fff; }
.rp-btn { background: transparent; color: var(--admin-text-soft); border: 1px solid var(--admin-border); border-radius: 8px; padding: 8px 14px; font-size: 13.5px; font-weight: 400; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-block; }
.rp-btn:hover:not(:disabled) { color: var(--admin-text); }
.rp-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.rp-field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--admin-text-faint); font-weight: 400; }
.rp-field select, .rp-field input { font-weight: 400; min-width: 200px; max-width: 100%; }
.rp-error { color: var(--admin-danger); font-size: 13px; margin-top: 8px; font-weight: 400; }
.rp-note { color: var(--admin-text-faint); font-size: 13px; line-height: 1.5; font-weight: 400; }
.rp-label { color: var(--admin-text-soft); font-size: 13px; font-weight: 400; }
.rp-stage { background: var(--admin-panel); border: 1px solid var(--admin-border); border-radius: 12px; padding: 16px; overflow: auto; }
.rp-measure { width: 100%; }
.rp-frame-outer { margin: 0 auto; position: relative; }
.rp-frame-inner { position: absolute; top: 0; left: 0; transform-origin: top left; background: #fff; border: 1px solid var(--admin-border); border-radius: 6px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,0.35); }
.rp-frame-inner iframe { display: block; border: 0; width: 100%; height: 100%; background: #fff; }
@media (max-width: 640px) {
  .rp-field, .rp-field select, .rp-field input { width: 100%; min-width: 0; }
  .rp-seg { width: 100%; }
  .rp-seg button { flex: 1; padding: 8px 6px; }
}
`;

export function ResponsivePreview() {
  const [device, setDevice] = useState<DeviceKey>("mobile");
  const [landscape, setLandscape] = useState(false);
  const [path, setPath] = useState("/");
  const [draft, setDraft] = useState("/");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [available, setAvailable] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const update = () => setAvailable(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dims = useMemo(() => {
    const d = DEVICES[device];
    const rotated = landscape && device !== "desktop";
    return { width: rotated ? d.height : d.width, height: rotated ? d.width : d.height };
  }, [device, landscape]);

  const scale = available > 0 ? Math.min(1, available / dims.width) : 1;
  const knownPage = PAGES.some((p) => p.path === path);

  function go(next: string) {
    const result = validatePreviewPath(next);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError("");
    setPath(result.path);
    setDraft(result.path);
  }

  return (
    <div className="rp-wrap">
      <style>{CSS}</style>

      <div className="rp-panel">
        <div className="rp-row">
          <div className="rp-seg" role="group" aria-label="Device size">
            {(Object.keys(DEVICES) as DeviceKey[]).map((key) => (
              <button key={key} type="button" aria-pressed={device === key} onClick={() => setDevice(key)}>
                {DEVICES[key].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rp-btn"
            aria-pressed={landscape}
            disabled={device === "desktop"}
            onClick={() => setLandscape((v) => !v)}
          >
            {landscape ? "Landscape" : "Portrait"} (rotate)
          </button>
          <button type="button" className="rp-btn" onClick={() => setReloadKey((k) => k + 1)}>
            Reload
          </button>
          <a className="rp-btn" href={path} target="_blank" rel="noopener noreferrer">
            Open in new tab
          </a>
        </div>

        <div className="rp-row">
          <label className="rp-field">
            Page
            <select
              className="field"
              value={knownPage ? path : ""}
              onChange={(e) => {
                if (e.target.value) go(e.target.value);
              }}
            >
              {!knownPage && <option value="">Custom path</option>}
              {PAGES.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.label} ({p.path})
                </option>
              ))}
            </select>
          </label>
          <form
            className="rp-row"
            style={{ margin: 0, alignItems: "flex-end" }}
            onSubmit={(e) => {
              e.preventDefault();
              go(draft);
            }}
          >
            <label className="rp-field">
              Or type a path
              <input
                className="field"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="/blog"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-invalid={error ? true : undefined}
              />
            </label>
            <button type="submit" className="rp-btn">
              Show
            </button>
          </form>
        </div>
        {error && (
          <div className="rp-error" role="alert">
            {error}
          </div>
        )}
      </div>

      <p className="rp-note">
        The preview shows the public site the way a signed-out visitor sees it. Backend and investor sign-ins use a separate
        session, so account pages will ask for a visitor login inside the frame. Only public paths on this site can be
        previewed.
      </p>

      <div className="rp-stage">
        <div className="rp-label" style={{ textAlign: "center", marginBottom: 10 }}>
          {DEVICES[device].label}: {dims.width} × {dims.height}
          {scale < 1 ? ` (shown at ${Math.round(scale * 100)}%)` : ""}
        </div>
        <div className="rp-measure" ref={measureRef}>
          <div
            className="rp-frame-outer"
            style={{ width: dims.width * scale, height: dims.height * scale }}
          >
            <div
              className="rp-frame-inner"
              style={{ width: dims.width, height: dims.height, transform: `scale(${scale})` }}
            >
              <iframe
                key={`${reloadKey}-${path}-${dims.width}`}
                src={path}
                title={`Site preview at ${dims.width} pixels wide`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
