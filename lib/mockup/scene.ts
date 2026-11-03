/**
 * A tiny 3D scene for the book mockups. Pure maths and text: no network, no database, no images.
 *
 * Each book is a box with six faces. Every face carries a "texture" (a piece of SVG drawn in pixels). The camera looks at the
 * scene from a little above; every visible face is projected to the screen and its texture is squeezed onto the face with a
 * single SVG matrix. The finished SVG is turned into a picture by lib/mockup/render.ts.
 *
 * Honest limits: the camera is orthographic (parallel lines stay parallel, as in a product photo shot with a long lens), there
 * is no ray tracing, and shadows are soft blurred shapes. The result is a clean studio-style still, not a photograph.
 */

export type V3 = [number, number, number];

export interface Tex { w: number; h: number; svg: string }
export interface TextureSet { front: Tex; back: Tex; spine: Tex; foreEdge: Tex; top: Tex; bottom: Tex }
export interface BookDims { w: number; h: number; t: number }

export interface Placement {
  dims: BookDims;
  tex: TextureSet;
  /** Lying flat with the front cover up (true) or standing upright (false). */
  lying: boolean;
  /** Turn about the vertical axis, in degrees. */
  yaw: number;
  /** Position of the book's centre on the floor, in inches. x to the right, z toward the viewer. */
  x: number;
  z: number;
  /** Height of the underside above the floor (a book lying on another book). */
  lift?: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function rotY(p: V3, deg: number): V3 {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
function rotX(p: V3, deg: number): V3 {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}

export interface FaceDef { key: keyof TextureSet; o: V3; u: V3; v: V3; normal: V3 }

/** The six faces of a book standing with its spine on the left. x from the spine to the fore-edge, y up, z toward the front cover. */
export function bookFaces(d: BookDims): FaceDef[] {
  const { w: W, h: H, t: T } = d;
  const a = T / 2;
  return [
    { key: "front", o: [0, H, a], u: [W, H, a], v: [0, 0, a], normal: [0, 0, 1] },
    { key: "back", o: [W, H, -a], u: [0, H, -a], v: [W, 0, -a], normal: [0, 0, -1] },
    { key: "spine", o: [0, H, -a], u: [0, H, a], v: [0, 0, -a], normal: [-1, 0, 0] },
    { key: "foreEdge", o: [W, H, a], u: [W, H, -a], v: [W, 0, a], normal: [1, 0, 0] },
    { key: "top", o: [0, H, a], u: [W, H, a], v: [0, H, -a], normal: [0, 1, 0] },
    { key: "bottom", o: [0, 0, -a], u: [W, 0, -a], v: [0, 0, a], normal: [0, -1, 0] },
  ];
}

const CAMERA_PITCH = 20;
const LIGHT: V3 = norm([-0.45, 0.85, 0.55]);

interface Prepared {
  placement: Placement;
  world: (p: V3) => V3;
  faces: { def: FaceDef; o: V3; u: V3; v: V3; n: V3 }[];
  corners: V3[];
  centerDepth: number;
}

function prepare(p: Placement): Prepared {
  const { w: W, h: H, t: T } = p.dims;
  const lift = p.lift ?? 0;
  const world = (q: V3): V3 => {
    if (p.lying) {
      // Centre the book on its own middle, lay it down (front cover up), turn it, then put it on the floor.
      const c = sub(q, [W / 2, H / 2, 0]);
      const laid = rotX(c, -90);
      const turned = rotY(laid, p.yaw);
      return [turned[0] + p.x, turned[1] + T / 2 + lift, turned[2] + p.z];
    }
    const c = sub(q, [W / 2, 0, 0]);
    const turned = rotY(c, p.yaw);
    return [turned[0] + p.x, turned[1] + lift, turned[2] + p.z];
  };
  // A direction (a face's outward normal) turns with the book but is not moved.
  const dir = (n: V3): V3 => (p.lying ? rotY(rotX(n, -90), p.yaw) : rotY(n, p.yaw));
  const faces = bookFaces(p.dims).map((def) => ({ def, o: world(def.o), u: world(def.u), v: world(def.v), n: dir(def.normal) }));
  const corners: V3[] = [];
  for (const x of [0, W]) for (const y of [0, H]) for (const z of [-T / 2, T / 2]) corners.push(world([x, y, z]));
  const centre = world([W / 2, H / 2, 0]);
  return { placement: p, world, faces, corners, centerDepth: rotX(centre, CAMERA_PITCH)[2] };
}

/** Screen position (before fitting) of a world point: look down at CAMERA_PITCH degrees. */
function toScreen(p: V3): { x: number; y: number; z: number } {
  const c = rotX(p, CAMERA_PITCH);
  return { x: c[0], y: -c[1], z: c[2] };
}

function hull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cr = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: { x: number; y: number }[] = [];
  for (const p of pts) { while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper: { x: number; y: number }[] = [];
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

export interface SceneOptions { width: number; height: number; margin?: number; defs?: string; /** A pre-blurred shadow picture (data address) from shadowLayerSvg, instead of drawing the shadows here. */ shadowLayer?: string }

/** Which faces of each book can be seen, for tests: by face key. */
export function visibleFaceKeys(p: Placement): (keyof TextureSet)[] {
  return prepare(p).faces.filter((f) => rotX(f.n, CAMERA_PITCH)[2] > 0.001).map((f) => f.def.key);
}

function makeFit(items: Prepared[], opts: SceneOptions) {
  const all = items.flatMap((it) => it.corners.map(toScreen));
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y));
  const margin = opts.margin ?? 0.1;
  const availW = opts.width * (1 - 2 * margin), availH = opts.height * (1 - 2 * margin);
  const scale = Math.min(availW / (maxX - minX), availH / (maxY - minY));
  const offX = (opts.width - (maxX - minX) * scale) / 2 - minX * scale;
  const offY = (opts.height - (maxY - minY) * scale) / 2 - minY * scale + opts.height * 0.02;
  return (p: V3) => { const s = toScreen(p); return { x: s.x * scale + offX, y: s.y * scale + offY }; };
}

/** The two soft shapes under each book, in canvas pixels: the long cast shadow and the dark contact line. */
function shadowShapes(items: Prepared[], px: (p: V3) => { x: number; y: number }) {
  const out: { cast: { x: number; y: number }[]; foot: { x: number; y: number }[] }[] = [];
  for (const it of items) {
    const T = it.placement.dims.t;
    const lift = it.placement.lift ?? 0;
    const cast = hull(it.corners.map((c) => px([c[0] + (c[1] - 0) * 0.55, 0, c[2] - (c[1] - 0) * 0.35])));
    const footPts = it.corners.filter((c) => c[1] <= lift + 0.01 + (it.placement.lying ? T : 0)).map((c) => px([c[0], 0, c[2]]));
    const foot = hull(footPts.length >= 3 ? footPts : cast);
    out.push({ cast, foot });
  }
  return out;
}

const pts = (a: { x: number; y: number }[], k = 1) => a.map((p) => `${f2(p.x / k)},${f2(p.y / k)}`).join(" ");

/**
 * The shadows alone, drawn small (1/k of the final size). Blurring is by far the slowest part of making the picture, and a soft
 * shadow does not need the detail, so this is blurred small and then stretched under the finished scene.
 */
export function shadowLayerSvg(placements: Placement[], opts: SceneOptions, k = 4): string {
  const items = placements.map(prepare).sort((a, b) => a.centerDepth - b.centerDepth);
  const px = makeFit(items, opts);
  const w = Math.round(opts.width / k), h = Math.round(opts.height / k);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>
<filter id="s1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f2((opts.width * 0.011) / k)}"/></filter>
<filter id="s2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f2((opts.width * 0.0035) / k)}"/></filter></defs>`;
  for (const sh of shadowShapes(items, px)) {
    if (sh.cast.length >= 3) svg += `<polygon points="${pts(sh.cast, k)}" fill="#1b1b28" opacity="0.2" filter="url(#s1)"/>`;
    if (sh.foot.length >= 3) svg += `<polygon points="${pts(sh.foot, k)}" fill="#000" opacity="0.38" filter="url(#s2)"/>`;
  }
  return `${svg}</svg>`;
}

export function composeScene(placements: Placement[], opts: SceneOptions): string {
  const items = placements.map(prepare).sort((a, b) => a.centerDepth - b.centerDepth);
  const px = makeFit(items, opts);

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}">`);
  out.push(`<defs>
<radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#f1f1f4"/><stop offset="1" stop-color="#e2e2e8"/></radialGradient>
<filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f2(opts.width * 0.011)}"/></filter>
<filter id="contactShadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f2(opts.width * 0.0035)}"/></filter>
${opts.defs ?? ""}
</defs>`);
  out.push(`<rect width="${opts.width}" height="${opts.height}" fill="url(#bg)"/>`);

  // Shadows first, so every book sits on top of all of them: the small pre-blurred layer when given, otherwise drawn here.
  if (opts.shadowLayer) {
    out.push(`<image x="0" y="0" width="${opts.width}" height="${opts.height}" preserveAspectRatio="none" xlink:href="${opts.shadowLayer}" href="${opts.shadowLayer}"/>`);
  } else {
    for (const sh of shadowShapes(items, px)) {
      if (sh.cast.length >= 3) out.push(`<polygon points="${pts(sh.cast)}" fill="#1b1b28" opacity="0.2" filter="url(#softShadow)"/>`);
      if (sh.foot.length >= 3) out.push(`<polygon points="${pts(sh.foot)}" fill="#000" opacity="0.38" filter="url(#contactShadow)"/>`);
    }
  }

  for (const it of items) {
    const visible = it.faces
      .map((f) => ({ f, camN: rotX(f.n, CAMERA_PITCH) }))
      .filter((x) => x.camN[2] > 0.001);
    // Within one box the visible faces never overlap, but keep a stable order.
    for (const { f } of visible) {
      const tex = it.placement.tex[f.def.key];
      const o = px(f.o), u = px(f.u), v = px(f.v);
      const m = [(u.x - o.x) / tex.w, (u.y - o.y) / tex.w, (v.x - o.x) / tex.h, (v.y - o.y) / tex.h, o.x, o.y].map((n) => Math.round(n * 10000) / 10000);
      const light = Math.max(0, dot(f.n, LIGHT));
      const dark = Math.min(0.3, Math.max(0, 0.3 - 0.38 * light));
      out.push(`<g transform="matrix(${m.join(" ")})"><svg x="0" y="0" width="${tex.w}" height="${tex.h}" viewBox="0 0 ${tex.w} ${tex.h}" overflow="hidden">${tex.svg}<rect width="${tex.w}" height="${tex.h}" fill="#0a0a1e" opacity="${f2(dark)}"/></svg></g>`);
    }
  }
  out.push("</svg>");
  return out.join("\n");
}

/** The standard scene: one copy standing with its front cover facing the viewer (turned just enough to show its thickness and spine), two lying flat in front. */
export function standardScene(standing: Omit<Placement, "x" | "z" | "yaw" | "lying" | "lift">, flat: Omit<Placement, "x" | "z" | "yaw" | "lying" | "lift">): Placement[] {
  const w = standing.dims.w, t = standing.dims.t;
  return [
    { ...standing, lying: false, yaw: 24, x: w * 0.08, z: -w * 0.1 },
    { ...flat, lying: true, yaw: 7, x: -w * 0.34, z: w * 0.74 + t },
    { ...flat, lying: true, yaw: -5, x: w * 0.3, z: w * 0.7, lift: flat.dims.t },
  ];
}
