export interface BarDatum {
  label: string;
  value: number;
}

/** A real vertical bar chart, pure CSS — every value here is a plain
 * count (sales, clicks, etc.), never currency; the caller decides what
 * unit label to show, this component just draws the bars. */
export function BarChart({ data, color = "var(--coral)", height = 140, valueSuffix = "" }: {
  data: BarDatum[];
  color?: string;
  height?: number;
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No data yet.</div>;
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: height + 30 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end" }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{d.value}{valueSuffix}</div>
          <div
            title={`${d.label}: ${d.value}${valueSuffix}`}
            style={{ width: "100%", background: color, borderRadius: "4px 4px 0 0", height: `${Math.max(4, (d.value / max) * height)}px` }}
          />
          <div style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 6, whiteSpace: "nowrap" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}
