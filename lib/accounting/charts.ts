/**
 * The 3D-style charts for Admin > Accounting and the monthly PDF report.
 *
 * Library: none. The charts are drawn by this file as a list of simple shapes (a "scene"): filled polygons, paths, lines and
 * text. components/accounting/Chart3D.tsx draws a scene on the page as SVG, and lib/accounting/report-pdf.ts draws the very same
 * scene into the PDF with pdf-lib. Because both read one scene, the charts on the page and in the PDF are identical.
 * The 3D look is a classic extruded style: every bar has a front face, a lighter top face and a darker side face; the pie is a
 * tilted disc with a visible thickness.
 *
 * Pure code (no database, no browser) so the geometry can be tested.
 */

export type Pt = [number, number];
export type TextTone = "ink" | "soft";

export type Shape =
  | { t: "poly"; pts: Pt[]; fill: string; stroke?: string }
  | { t: "path"; d: string; fill: string; stroke?: string }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; w: number }
  | { t: "text"; x: number; y: number; s: string; size: number; anchor: "start" | "middle" | "end"; bold?: boolean; tone: TextTone }
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string };

export interface Scene {
  width: number;
  height: number;
  shapes: Shape[];
  /** Plain-text summary for screen readers. */
  alt: string;
}

/** Colour-blind-safe-ish distinct colours, in a fixed order so the same thing is always the same colour. */
export const PALETTE = ["#6E3FA3", "#1B998B", "#E9A23B", "#D9534F", "#3F7CAC", "#7BAE5A", "#8C8C99", "#B5588A"];

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Lightens (amount > 0) or darkens (amount < 0) a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return clamp(Math.round(v), 0, 255);
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  return `${sign}$${a >= 10000 ? Math.round(a).toLocaleString("en-US") : a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "Nice" axis limits and step for a data range that includes zero. */
export function niceAxis(min: number, max: number, ticks = 4): { lo: number; hi: number; step: number } {
  const lo0 = Math.min(0, min);
  const hi0 = Math.max(0, max);
  if (hi0 === lo0) return { lo: 0, hi: 1, step: 0.25 };
  const raw = (hi0 - lo0) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return { lo: Math.floor(lo0 / step) * step, hi: Math.ceil(hi0 / step) * step, step };
}

function bar3d(shapes: Shape[], x: number, yTop: number, w: number, yBase: number, dx: number, dy: number, color: string) {
  // y grows downward. yTop is the value end, yBase the zero line (they swap for a negative value).
  const top = Math.min(yTop, yBase);
  const bottom = Math.max(yTop, yBase);
  if (bottom - top < 0.5) {
    shapes.push({ t: "line", x1: x, y1: yBase, x2: x + w + dx, y2: yBase - dy, stroke: color, w: 1 });
    return;
  }
  shapes.push({ t: "poly", pts: [[x + w, top], [x + w + dx, top - dy], [x + w + dx, bottom - dy], [x + w, bottom]], fill: shade(color, -0.32) });
  shapes.push({ t: "poly", pts: [[x, top], [x + dx, top - dy], [x + w + dx, top - dy], [x + w, top]], fill: shade(color, 0.28) });
  shapes.push({ t: "poly", pts: [[x, top], [x + w, top], [x + w, bottom], [x, bottom]], fill: color });
}

export interface BarSeries {
  name: string;
  values: number[];
  color?: string;
}

/** Grouped 3D bar chart: one cluster per category, one bar per series. */
export function barChartScene(opts: { title: string; categories: string[]; series: BarSeries[]; width?: number; height?: number; valueLabels?: boolean; alt?: string }): Scene {
  const width = opts.width ?? 720;
  const height = opts.height ?? 330;
  const shapes: Shape[] = [];
  const left = 62, right = 16, top = 40, bottom = opts.series.length > 1 ? 70 : 50;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const all = opts.series.flatMap((s) => s.values);
  const { lo, hi, step } = niceAxis(Math.min(0, ...all), Math.max(0, ...all));
  const yOf = (v: number) => top + plotH - ((v - lo) / (hi - lo)) * plotH;
  const y0 = yOf(0);

  shapes.push({ t: "text", x: left, y: 20, s: opts.title, size: 14, anchor: "start", bold: true, tone: "ink" });
  for (let v = lo; v <= hi + step / 1000; v += step) {
    const y = yOf(v);
    shapes.push({ t: "line", x1: left, y1: y, x2: left + plotW, y2: y, stroke: "#9aa0b4", w: 0.6 });
    shapes.push({ t: "text", x: left - 6, y: y + 3.5, s: money(v).replace(/\.00$/, ""), size: 9, anchor: "end", tone: "soft" });
  }
  const n = Math.max(1, opts.categories.length);
  const groupW = plotW / n;
  const k = Math.max(1, opts.series.length);
  const depth = clamp(groupW / (k + 1.2) * 0.28, 3, 9);
  const barW = clamp((groupW * 0.72 - depth) / k, 4, 46);
  const clusterW = barW * k + depth;
  opts.categories.forEach((cat, ci) => {
    const gx = left + ci * groupW + (groupW - clusterW) / 2;
    opts.series.forEach((s, si) => {
      const v = s.values[ci] ?? 0;
      const color = s.color ?? PALETTE[si % PALETTE.length];
      bar3d(shapes, gx + si * barW, yOf(v), barW - 1, y0, depth, depth * 0.8, color);
      if (opts.valueLabels && n * k <= 14) {
        const ty = v >= 0 ? yOf(v) - depth * 0.8 - 4 : yOf(v) + 11;
        shapes.push({ t: "text", x: gx + si * barW + barW / 2, y: ty, s: money(v).replace(/\.00$/, ""), size: 8.5, anchor: "middle", tone: "ink" });
      }
    });
    shapes.push({ t: "text", x: left + ci * groupW + groupW / 2, y: top + plotH + 14, s: cat, size: 9, anchor: "middle", tone: "soft" });
  });
  shapes.push({ t: "line", x1: left, y1: y0, x2: left + plotW, y2: y0, stroke: "#888", w: 1 });
  if (opts.series.length > 1) {
    let lx = left;
    for (let i = 0; i < opts.series.length; i++) {
      const color = opts.series[i].color ?? PALETTE[i % PALETTE.length];
      shapes.push({ t: "rect", x: lx, y: height - 22, w: 10, h: 10, fill: color });
      shapes.push({ t: "text", x: lx + 14, y: height - 13, s: opts.series[i].name, size: 10, anchor: "start", tone: "ink" });
      lx += 24 + opts.series[i].name.length * 5.6;
    }
  }
  const alt = opts.alt ?? `${opts.title}. ${opts.series.map((s) => `${s.name}: ${opts.categories.map((c, i) => `${c} ${money(s.values[i] ?? 0)}`).join(", ")}`).join(". ")}`;
  return { width, height, shapes, alt };
}

export interface Slice {
  label: string;
  value: number;
  color?: string;
}

function polar(cx: number, cy: number, rx: number, ry: number, a: number): Pt {
  return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
}

const f = (n: number) => Number(n.toFixed(2));

/** 3D pie: a tilted disc with thickness. Only slices above zero are drawn. */
export function pieChartScene(opts: { title: string; slices: Slice[]; width?: number; height?: number; alt?: string }): Scene {
  const width = opts.width ?? 720;
  const height = opts.height ?? 300;
  const shapes: Shape[] = [];
  const slices = opts.slices.map((s, i) => ({ ...s, color: s.color ?? PALETTE[i % PALETTE.length] })).filter((s) => s.value > 0.004);
  const total = slices.reduce((s, x) => s + x.value, 0);
  shapes.push({ t: "text", x: 16, y: 20, s: opts.title, size: 14, anchor: "start", bold: true, tone: "ink" });
  const alt = opts.alt ?? `${opts.title}. ${slices.map((s) => `${s.label} ${money(s.value)}`).join(", ")}`;
  if (total <= 0) {
    shapes.push({ t: "text", x: width / 2, y: height / 2, s: "No money received in this period.", size: 12, anchor: "middle", tone: "soft" });
    return { width, height, shapes, alt };
  }
  const cx = 170, cy = 140, rx = 130, ry = 70, depth = 24;
  let a0 = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const sweep = (s.value / total) * Math.PI * 2;
    const a1 = a0 + sweep;
    const r = { a0, a1, s };
    a0 = a1;
    return r;
  });
  // Sides first (only the lower half of the disc is visible), then the tops.
  for (const { a0: s0, a1: s1, s } of arcs) {
    // Angles start at -90 degrees; normalise into [0, 2pi) for the "front half" test.
    const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const segs: [number, number][] = [];
    const A = norm(s0), B = A + (s1 - s0);
    // visible when sin(a) > 0 => a in (0, pi), repeated every 2pi
    for (const base of [0, Math.PI * 2]) {
      const lo = Math.max(A, base), hi = Math.min(B, base + Math.PI);
      if (hi > lo + 1e-6) segs.push([lo - base, hi - base]);
    }
    for (const [lo, hi] of segs) {
      const p0 = polar(cx, cy, rx, ry, lo), p1 = polar(cx, cy, rx, ry, hi);
      const large = hi - lo > Math.PI ? 1 : 0;
      const d = `M ${f(p0[0])} ${f(p0[1])} A ${rx} ${ry} 0 ${large} 1 ${f(p1[0])} ${f(p1[1])} L ${f(p1[0])} ${f(p1[1] + depth)} A ${rx} ${ry} 0 ${large} 0 ${f(p0[0])} ${f(p0[1] + depth)} Z`;
      shapes.push({ t: "path", d, fill: shade(s.color, -0.35) });
    }
  }
  for (const { a0: s0, a1: s1, s } of arcs) {
    const p0 = polar(cx, cy, rx, ry, s0), p1 = polar(cx, cy, rx, ry, s1);
    const full = s1 - s0 >= Math.PI * 2 - 1e-6;
    if (full) {
      const pm = polar(cx, cy, rx, ry, s0 + Math.PI);
      shapes.push({ t: "path", d: `M ${f(p0[0])} ${f(p0[1])} A ${rx} ${ry} 0 1 1 ${f(pm[0])} ${f(pm[1])} A ${rx} ${ry} 0 1 1 ${f(p0[0])} ${f(p0[1])} Z`, fill: s.color });
    } else {
      const large = s1 - s0 > Math.PI ? 1 : 0;
      shapes.push({ t: "path", d: `M ${cx} ${cy} L ${f(p0[0])} ${f(p0[1])} A ${rx} ${ry} 0 ${large} 1 ${f(p1[0])} ${f(p1[1])} Z`, fill: s.color, stroke: shade(s.color, -0.45) });
    }
  }
  // Legend
  let ly = 62;
  const lx = 350;
  for (const s of slices) {
    shapes.push({ t: "rect", x: lx, y: ly - 9, w: 10, h: 10, fill: s.color });
    shapes.push({ t: "text", x: lx + 16, y: ly, s: `${s.label}`, size: 11, anchor: "start", tone: "ink" });
    shapes.push({ t: "text", x: width - 16, y: ly, s: `${money(s.value)}  (${((s.value / total) * 100).toFixed(1)}%)`, size: 11, anchor: "end", tone: "soft" });
    ly += 26;
  }
  return { width, height, shapes, alt };
}
