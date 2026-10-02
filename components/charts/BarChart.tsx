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
    // width/maxWidth 100% plus minWidth:0 on every bar below is what
    // actually keeps this chart inside its card on a narrow phone. Flex
    // items default to a min-width equal to their own content size (the
    // nowrap month label, in this case), so with 12 of them in one row
    // the browser was letting the whole chart grow past its container
    // instead of shrinking the bars to fit — the row then overflowed off
    // the right edge of the card, reading as the chart being skewed/
    // leaning right instead of centered. Forcing minWidth:0 lets flex:1
    // actually shrink each bar down to the available width.
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: height + 30, width: "100%", maxWidth: "100%" }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0, height: "100%", justifyContent: "flex-end" }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{d.value}{valueSuffix}</div>
          <div
            title={`${d.label}: ${d.value}${valueSuffix}`}
            style={{ width: "100%", background: color, borderRadius: "4px 4px 0 0", height: `${Math.max(4, (d.value / max) * height)}px` }}
          />
          <div style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}
