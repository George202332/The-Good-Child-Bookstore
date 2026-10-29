export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

/** A real pie/donut chart built from CSS conic-gradient — no charting
 * library dependency (deliberately avoided after an earlier
 * incompatibility with this project's build tool from a different
 * third-party package). Renders a color legend with percentages
 * alongside it. Purely presentational — all values are plain counts,
 * never currency. */
export function PieChart({ data, size = 160, donut = true, legendOffset, compact = false }: {
  data: PieSlice[]; size?: number; donut?: boolean; legendOffset?: string;
  /** Tighter legend that stays to the RIGHT of the donut in a narrow card (author dashboard). */
  compact?: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--line)", flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>No data yet.</div>
      </div>
    );
  }

  let cumulative = 0;
  const stops: string[] = [];
  data.forEach((d) => {
    const startPct = (cumulative / total) * 100;
    cumulative += d.value;
    const endPct = (cumulative / total) * 100;
    stops.push(`${d.color} ${startPct}% ${endPct}%`);
  });

  return (
    // justifyContent:"center" plus width:100% is what keeps the pie +
    // legend centered as a unit once flexWrap puts the legend on its own
    // row on a narrow phone — without it the default flex-start left-
    // aligns each wrapped row, so on mobile (where this chart's card is
    // often wider than the pie+legend's own content) the whole thing sat
    // off to one side instead of balanced in the card.
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: compact ? 16 : 24, flexWrap: "wrap", width: "100%" }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `conic-gradient(${stops.join(", ")})`,
          flexShrink: 0,
          position: "relative",
        }}
      >
        {donut && (
          <div
            style={{
              position: "absolute", inset: size * 0.28, borderRadius: "50%",
              background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: size * 0.11, fontWeight: 700, color: "var(--ink)",
            }}
          >
            {total}
          </div>
        )}
      </div>
      <ChartLegend data={data} total={total} marginLeft={legendOffset} compact={compact} />
    </div>
  );
}

/** The legend beside a pie/donut chart. Every row is one neat line: a coloured dot and the
 * name on the left, then the count and the percentage in straight, right-aligned columns so
 * the figures line up vertically down all rows. Used by every pie chart so they all match. */
export function ChartLegend({ data, total, marginLeft, compact = false }: { data: PieSlice[]; total: number; marginLeft?: string; compact?: boolean }) {
  return (
    <div className={compact ? "chart-legend-grid chart-legend-compact" : "chart-legend-grid"} style={{ marginLeft }} role="list">
      {data.map((d) => (
        <div key={d.label} className="chart-legend-row" role="listitem">
          <span className="chart-legend-swatch" style={{ background: d.color }} aria-hidden />
          <span className="chart-legend-name" title={d.label}>{d.label}</span>
          <span className="chart-legend-count">{d.value}</span>
          <span className="chart-legend-pct">{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
        </div>
      ))}
    </div>
  );
}
