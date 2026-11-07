/**
 * "How This Cost Is Worked Out": the explanation under a printing cost (where the figure comes from, and the book
 * settings it is based on, shown as small tags). A soft cream-and-lilac panel with a thin purple edge. The words and the
 * live updating are unchanged; only the look is new.
 */
export function PrintingCostNote({ sourceLabel, specs }: { sourceLabel: string; specs: string[] }) {
  return (
    <div className="cost-note" role="note">
      <style>{css}</style>
      <strong className="cost-note-title">How This Cost Is Worked Out</strong>
      <div className="cost-note-source">{sourceLabel}</div>
      {specs.length > 0 && (
        <div className="cost-note-tags" aria-label="Based on">
          <span className="cost-note-based">Based on</span>
          {specs.map((t) => <span key={t} className="cost-note-tag">{t}</span>)}
        </div>
      )}
    </div>
  );
}

const css = `
.cost-note{margin-top:8px;padding:10px 12px;border-radius:10px;background:linear-gradient(180deg,#FBF6EC,#F3EDFA);border:1px solid #B9A4E0;text-align:left}
.cost-note-title{display:block;font-size:12.5px;color:#2E2440;margin-bottom:3px}
.cost-note-source{font-size:12px;color:#5b4f73;line-height:1.35}
.cost-note-tags{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-top:7px}
.cost-note-based{font-size:11px;font-weight:700;color:#6b5f80;margin-right:2px}
.cost-note-tag{font-size:11.5px;font-weight:600;color:#3A2C62;background:#fff;border:1px solid #D9CCF0;border-radius:6px;padding:2px 8px;white-space:nowrap}
html.dark-mode .cost-note{background:var(--paper);border-color:#6b5a96}
html.dark-mode .cost-note-title{color:var(--ink)}
html.dark-mode .cost-note-source,html.dark-mode .cost-note-based{color:var(--ink-soft)}
html.dark-mode .cost-note-tag{background:var(--cream);color:var(--ink);border-color:var(--line)}
`;
