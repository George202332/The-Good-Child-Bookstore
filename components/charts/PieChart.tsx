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
export function PieChart({ data, size = 160, donut = true }: { data: PieSlice[]; size?: number; donut?: boolean }) {
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
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
            <span style={{ color: "var(--ink-soft)" }}>{d.label}</span>
            <span style={{ fontWeight: 700 }}>{d.value}</span>
            <span style={{ color: "var(--ink-faint)" }}>({total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
