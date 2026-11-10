"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * "How This Cost Is Worked Out": a small trigger beside a printing cost. Hover (computer) or tap (phone) opens a pop-up card
 * floating over the page with where the figure comes from and the book settings it is based on, shown as tags. The card is
 * positioned over the page, never inside the flow, so opening it can never push the Pricing section down. Click elsewhere, or
 * press Escape, to close. Paperback and Hardcover each render their own, with their own details; the content updates live
 * as the author changes the options, because it is drawn from the same values.
 */
export function PrintingCostNote({ label, sourceLabel, specs }: { label: string; sourceLabel: string; specs: string[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <span
      ref={box}
      className="cost-pop"
      onMouseEnter={(e) => { if (window.matchMedia("(hover:hover)").matches) setOpen(true); void e; }}
      onMouseLeave={() => { if (window.matchMedia("(hover:hover)").matches) setOpen(false); }}
    >
      <style>{css}</style>
      <button type="button" className="cost-pop-trigger" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true" className="cost-pop-i">i</span> How This Cost Is Worked Out
      </button>
      {open && (
        <span id={id} role="dialog" aria-label={`How the ${label} printing cost is worked out`} className="cost-pop-card">
          <strong className="cost-pop-title">How The {label} Cost Is Worked Out</strong>
          <span className="cost-pop-source">{sourceLabel}</span>
          {specs.length > 0 && (
            <span className="cost-pop-tags" aria-label="Based on">
              <span className="cost-pop-based">Based on</span>
              {specs.map((t) => <span key={t} className="cost-pop-tag">{t}</span>)}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

const css = `
.cost-pop{position:relative;display:inline-block;margin-top:4px}
.cost-pop-trigger{display:inline-flex;align-items:center;gap:5px;background:none;border:0;padding:0;font-size:11.5px;font-weight:700;color:#4A3868;cursor:pointer;text-decoration:underline;text-underline-offset:2px;white-space:nowrap}
.cost-pop-i{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;border:1.5px solid #4A3868;font-size:9px;font-style:italic;font-family:Georgia,serif;line-height:1}
.cost-pop-card{position:absolute;z-index:40;left:0;top:100%;margin-top:6px;width:min(300px, 80vw);display:block;padding:12px 14px;border-radius:12px;background:linear-gradient(180deg,#FBF6EC,#F3EDFA);border:1px solid #B9A4E0;box-shadow:0 12px 30px rgba(46,36,66,.22);text-align:left;white-space:normal}
.cost-pop-title{display:block;font-size:12.5px;color:#2E2440;margin-bottom:4px}
.cost-pop-source{display:block;font-size:12px;color:#5b4f73;line-height:1.4}
.cost-pop-tags{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-top:8px}
.cost-pop-based{font-size:11px;font-weight:700;color:#6b5f80;margin-right:2px}
.cost-pop-tag{font-size:11.5px;font-weight:600;color:#3A2C62;background:#fff;border:1px solid #D9CCF0;border-radius:6px;padding:2px 8px;white-space:nowrap}
html.dark-mode .cost-pop-card{background:var(--paper);border-color:#6b5a96}
html.dark-mode .cost-pop-title{color:var(--ink)}
html.dark-mode .cost-pop-trigger{color:var(--ink)}
html.dark-mode .cost-pop-i{border-color:var(--ink)}
html.dark-mode .cost-pop-source,html.dark-mode .cost-pop-based{color:var(--ink-soft)}
html.dark-mode .cost-pop-tag{background:var(--cream);color:var(--ink);border-color:var(--line)}
@media (max-width:600px){.cost-pop-card{left:50%;transform:translateX(-30%)}}
`;
