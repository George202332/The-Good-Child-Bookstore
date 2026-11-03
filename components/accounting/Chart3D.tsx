import type { Scene } from "@/lib/accounting/charts";

/** Draws a chart scene (lib/accounting/charts.ts) as SVG. The PDF report draws the same scene, so the two always match. */
export function Chart3D({ scene }: { scene: Scene }) {
  return (
    <svg viewBox={`0 0 ${scene.width} ${scene.height}`} role="img" aria-label={scene.alt} style={{ width: "100%", height: "auto", display: "block" }}>
      <title>{scene.alt}</title>
      {scene.shapes.map((s, i) => {
        switch (s.t) {
          case "poly":
            return <polygon key={i} points={s.pts.map((p) => p.join(",")).join(" ")} fill={s.fill} stroke={s.stroke} strokeWidth={s.stroke ? 0.6 : undefined} />;
          case "path":
            return <path key={i} d={s.d} fill={s.fill} stroke={s.stroke} strokeWidth={s.stroke ? 0.6 : undefined} />;
          case "line":
            return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.w} />;
          case "rect":
            return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} rx={1.5} />;
          case "text":
            return (
              <text key={i} x={s.x} y={s.y} fontSize={s.size} textAnchor={s.anchor} fontWeight={s.bold ? 700 : 400} style={{ fill: s.tone === "ink" ? "var(--ink)" : "var(--ink-soft)" }}>
                {s.s}
              </text>
            );
        }
      })}
    </svg>
  );
}
