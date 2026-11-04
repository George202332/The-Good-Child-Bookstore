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
  /** Drawing order, lowest first. When given it decides which book is in front, instead of the guess from the depth of its centre. */
  order?: number;
  /** An upright book leaning back (top away from the viewer), in degrees. */
  tilt?: number;
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

const CAMERA_PITCH = 28;
const CAMERA_DISTANCE = 70;
/** How far the spine bulges outwards in the middle, as a share of the book's thickness (a rounded spine, not a flat one). */
const SPINE_BULGE = 0.16;
/** Patches each face is cut into, so the perspective and the curved spine follow the surface: [across, down]. */
const GRID: Record<keyof TextureSet, [number, number]> = { front: [4, 5], back: [4, 5], spine: [6, 4], foreEdge: [2, 3], top: [4, 2], bottom: [4, 2] };
const LIGHT: V3 = norm([-0.45, 0.85, 0.55]);

interface Prepared {
  placement: Placement;
  world: (p: V3) => V3;
  faces: { def: FaceDef; o: V3; u: V3; v: V3; n: V3 }[];
  corners: V3[];
  centerDepth: number;
}

function prepare(p: Placement, mirror = false): Prepared {
  const { w: W, h: H, t: T } = p.dims;
  const lift = p.lift ?? 0;
  const flat = (q: V3): V3 => {
    if (p.lying) {
      // Centre the book on its own middle, lay it down (front cover up), turn it, then put it on the floor.
      const c = sub(q, [W / 2, H / 2, 0]);
      const laid = rotX(c, -90);
      const turned = rotY(laid, p.yaw);
      return [turned[0] + p.x, turned[1] + T / 2 + lift, turned[2] + p.z];
    }
    const c = sub(q, [W / 2, 0, 0]);
    const turned = rotY(rotX(c, -(p.tilt ?? 0)), p.yaw);
    return [turned[0] + p.x, turned[1] + lift, turned[2] + p.z];
  };
  // A mirrored copy is the reflection in the floor: the same book upside down below it.
  const world = (q: V3): V3 => { const w = flat(q); return mirror ? [w[0], -w[1], w[2]] : w; };
  // A direction (a face's outward normal) turns with the book but is not moved.
  const dir0 = (n: V3): V3 => (p.lying ? rotY(rotX(n, -90), p.yaw) : rotY(rotX(n, -(p.tilt ?? 0)), p.yaw));
  const dir = (n: V3): V3 => { const d = dir0(n); return mirror ? [d[0], -d[1], d[2]] : d; };
  const faces = bookFaces(p.dims).map((def) => ({ def, o: world(def.o), u: world(def.u), v: world(def.v), n: dir(def.normal) }));
  const corners: V3[] = [];
  for (const x of [0, W]) for (const y of [0, H]) for (const z of [-T / 2, T / 2]) corners.push(world([x, y, z]));
  const centre = world([W / 2, H / 2, 0]);
  return { placement: p, world, faces, corners, centerDepth: rotX(centre, CAMERA_PITCH)[2] };
}

/** Screen position (before fitting) of a world point: look down at CAMERA_PITCH degrees. */
function toScreen(p: V3): { x: number; y: number; z: number } {
  const c = rotX(p, CAMERA_PITCH);
  // A real camera: things nearer the lens look a little bigger (the lens is CAMERA_DISTANCE inches from the middle of the scene).
  const k = CAMERA_DISTANCE / (CAMERA_DISTANCE - c[2]);
  return { x: c[0] * k, y: -c[1] * k, z: c[2] };
}

const byDrawingOrder = (a: Prepared, b: Prepared) => (a.placement.order ?? 0) - (b.placement.order ?? 0) || a.centerDepth - b.centerDepth;

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

export interface SceneOptions { width: number; height: number; margin?: number; /** Share of the height kept free at the bottom for the reflection (0 to 0.3). */ reserveBottom?: number; /** Draw the soft reflection of the books in the floor. */ reflection?: boolean; defs?: string; /** Paint a pale studio backdrop (default). False leaves the picture transparent so it sits on the page's own background. */ backdrop?: boolean; /** A pre-blurred shadow picture (data address) from shadowLayerSvg, instead of drawing the shadows here. */ shadowLayer?: string }

/** Which faces of each book can be seen, for tests: by face key. */
export function visibleFaceKeys(p: Placement): (keyof TextureSet)[] {
  return prepare(p).faces.filter((f) => rotX(f.n, CAMERA_PITCH)[2] > 0.001).map((f) => f.def.key);
}

function makeFit(items: Prepared[], opts: SceneOptions) {
  const all = items.flatMap((it) => it.corners.map(toScreen));
  const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y));
  const margin = opts.margin ?? 0.1;
  const usableH = opts.height * (1 - (opts.reserveBottom ?? 0));
  const availW = opts.width * (1 - 2 * margin), availH = usableH * (1 - 2 * margin);
  const scale = Math.min(availW / (maxX - minX), availH / (maxY - minY));
  const offX = (opts.width - (maxX - minX) * scale) / 2 - minX * scale;
  const offY = (usableH - (maxY - minY) * scale) / 2 - minY * scale + usableH * 0.02;
  return (p: V3) => { const s = toScreen(p); return { x: s.x * scale + offX, y: s.y * scale + offY }; };
}

/** The two soft shapes under each book, in canvas pixels: the long cast shadow and the dark contact line. */
function shadowShapes(items: Prepared[], px: (p: V3) => { x: number; y: number }) {
  const out: { cast: { x: number; y: number }[]; foot: { x: number; y: number }[] }[] = [];
  for (const it of items) {
    const T = it.placement.dims.t;
    const lift = it.placement.lift ?? 0;
    const cast = hull(it.corners.map((c) => px([c[0] + (c[1] - 0) * 0.32, 0, c[2] - (c[1] - 0) * 0.2])));
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
  const items = placements.map((p) => prepare(p)).sort(byDrawingOrder);
  const px = makeFit(items, opts);
  const w = Math.round(opts.width / k), h = Math.round(opts.height / k);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>
<filter id="s1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f2((opts.width * 0.011) / k)}"/></filter>
<filter id="s2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f2((opts.width * 0.0035) / k)}"/></filter></defs>`;
  for (const sh of shadowShapes(items, px)) {
    if (sh.cast.length >= 3) svg += `<polygon points="${pts(sh.cast, k)}" fill="#1b1b28" opacity="0.15" filter="url(#s1)"/>`;
    if (sh.foot.length >= 3) svg += `<polygon points="${pts(sh.foot, k)}" fill="#000" opacity="0.38" filter="url(#s2)"/>`;
  }
  return `${svg}</svg>`;
}

export function composeScene(placements: Placement[], opts: SceneOptions): string {
  const items = placements.map((p) => prepare(p)).sort(byDrawingOrder);
  const px = makeFit(items, opts);

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}">`);
  out.push(`<defs>
<radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#f1f1f4"/><stop offset="1" stop-color="#e2e2e8"/></radialGradient>
<filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f2(opts.width * 0.011)}"/></filter>
<filter id="contactShadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f2(opts.width * 0.0035)}"/></filter>
${opts.defs ?? ""}
</defs>`);
  if (opts.backdrop) out.push(`<rect width="${opts.width}" height="${opts.height}" fill="url(#bg)"/>`);

  // Shadows first, so every book sits on top of all of them: the small pre-blurred layer when given, otherwise drawn here.
  if (opts.shadowLayer) {
    out.push(`<image x="0" y="0" width="${opts.width}" height="${opts.height}" preserveAspectRatio="none" xlink:href="${opts.shadowLayer}" href="${opts.shadowLayer}"/>`);
  } else {
    for (const sh of shadowShapes(items, px)) {
      if (sh.cast.length >= 3) out.push(`<polygon points="${pts(sh.cast)}" fill="#1b1b28" opacity="0.2" filter="url(#softShadow)"/>`);
      if (sh.foot.length >= 3) out.push(`<polygon points="${pts(sh.foot)}" fill="#000" opacity="0.38" filter="url(#contactShadow)"/>`);
    }
  }

  // Each texture is written once (in <defs>) and used by every patch of every face that carries it.
  const texIds = new Map<object, string>();
  const texDefs: string[] = [];
  const texId = (tex: Tex): string => {
    let id = texIds.get(tex);
    if (!id) { id = `tx${texIds.size}`; texIds.set(tex, id); texDefs.push(`<g id="${id}">${tex.svg}</g>`); }
    return id;
  };
  const EPS = 2; // patches overlap by under a pixel so no hairline shows between them

  const drawItem = (it: Prepared, mirrored = false) => {
    const visible = it.faces
      .map((f) => ({ f, camN: rotX(f.n, CAMERA_PITCH) }))
      .filter((x) => x.camN[2] > 0.001);
    for (const { f } of visible) {
      const tex = it.placement.tex[f.def.key];
      const id = texId(tex);
      // The faint reflection needs fewer patches than the real books.
      const [gs, gt] = GRID[f.def.key].map((n) => (mirrored ? Math.max(1, Math.ceil(n / 2)) : n)) as [number, number];
      const bulge = f.def.key === "spine" ? SPINE_BULGE * it.placement.dims.t : 0;
      // A point on the face: s across (0..1 from the face's o to its u), t down (0..1 from o to v), pushed out along the normal by the bulge.
      const P = (sc: number, tc: number) => {
        const q: V3 = [f.o[0] + (f.u[0] - f.o[0]) * sc + (f.v[0] - f.o[0]) * tc, f.o[1] + (f.u[1] - f.o[1]) * sc + (f.v[1] - f.o[1]) * tc, f.o[2] + (f.u[2] - f.o[2]) * sc + (f.v[2] - f.o[2]) * tc];
        const k = bulge * (1 - (2 * sc - 1) ** 2);
        return px([q[0] + f.n[0] * k, q[1] + f.n[1] * k, q[2] + f.n[2] * k]);
      };
      for (let i = 0; i < gs; i++) {
        for (let j = 0; j < gt; j++) {
          const s0 = i / gs, s1 = (i + 1) / gs, t0 = j / gt, t1 = (j + 1) / gt;
          const O = P(s0, t0), U = P(s1, t0), V = P(s0, t1);
          const dx = (s1 - s0) * tex.w, dy = (t1 - t0) * tex.h;
          const a = (U.x - O.x) / dx, b = (U.y - O.y) / dx, c = (V.x - O.x) / dy, d = (V.y - O.y) / dy;
          const e = O.x - a * s0 * tex.w - c * t0 * tex.h, g = O.y - b * s0 * tex.w - d * t0 * tex.h;
          const x0 = s0 * tex.w - (i > 0 ? EPS : 0), y0 = t0 * tex.h - (j > 0 ? EPS : 0);
          const x1 = s1 * tex.w + (i < gs - 1 ? EPS : 0), y1 = t1 * tex.h + (j < gt - 1 ? EPS : 0);
          const m = [a, b, c, d, e, g].map((n) => Math.round(n * 10000) / 10000);
          out.push(`<g transform="matrix(${m.join(" ")})"><svg x="${f2(x0)}" y="${f2(y0)}" width="${f2(x1 - x0)}" height="${f2(y1 - y0)}" viewBox="${f2(x0)} ${f2(y0)} ${f2(x1 - x0)} ${f2(y1 - y0)}" overflow="hidden"><use href="#${id}" xlink:href="#${id}"/></svg></g>`);
        }
      }
      // Light and shade over the whole face: faces turned away from the light are darker.
      const light = Math.max(0, dot(f.n, LIGHT));
      const dark = Math.min(0.3, Math.max(0, 0.3 - 0.38 * light)) + (mirrored ? 0.05 : 0);
      const ring: { x: number; y: number }[] = [];
      for (let i = 0; i <= gs; i++) ring.push(P(i / gs, 0));
      for (let j = 1; j <= gt; j++) ring.push(P(1, j / gt));
      for (let i = gs - 1; i >= 0; i--) ring.push(P(i / gs, 1));
      for (let j = gt - 1; j >= 1; j--) ring.push(P(0, j / gt));
      out.push(`<polygon points="${pts(ring)}" fill="#0a0a1e" opacity="${f2(dark)}"/>`);
    }
  };

  if (opts.reflection) {
    // The reflection: every book again, upside down in the floor, fading out with distance.
    const mirrored = placements.map((p) => prepare(p, true)).sort(byDrawingOrder).reverse();
    const floorY = Math.max(...items.flatMap((it) => it.corners.filter((c) => c[1] <= (it.placement.lift ?? 0) + 0.01 + (it.placement.lying ? it.placement.dims.t : 0)).map((c) => px([c[0], 0, c[2]]).y)));
    const fade = opts.height * (opts.reserveBottom ?? 0.12) * 1.1;
    out.push(`<defs><linearGradient id="reflFade" gradientUnits="userSpaceOnUse" x1="0" y1="${f2(floorY)}" x2="0" y2="${f2(floorY + fade)}"><stop offset="0" stop-color="#fff" stop-opacity="0.34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="reflMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${opts.width}" height="${opts.height}"><rect x="0" y="${f2(floorY - fade * 0.2)}" width="${opts.width}" height="${f2(fade * 1.4)}" fill="url(#reflFade)"/></mask></defs>`);
    out.push('<g mask="url(#reflMask)">');
    for (const it of mirrored) drawItem(it, true);
    out.push("</g>");
  }
  for (const it of items) drawItem(it);
  out.splice(1, 0, `<defs>${texDefs.join("\n")}</defs>`);
  out.push("</svg>");
  return out.join("\n");
}

/** The numbers behind the standard scene (angles in degrees, offsets in book widths/heights). Exported so they can be tuned in one place. */
export const SCENE_LAYOUT = {
  /** Turn of the standing copy (spine to the left, front towards the right). */
  standYaw: 27,
  /** Lean of the standing copy: its top tips away from the viewer. */
  standTilt: 10,
  /** Turn of the pile of flat copies, and the small extra turn of each copy up the pile. */
  stackYaw: -128,
  stackJitter: [0, -3, 4],
  /** Each copy up the pile is shifted this far (in inches) towards the front-left of the one below it. */
  stepX: -0.35,
  stepZ: 0.3,
  /** Where the standing copy rests on the top copy, in book heights from the pile's centre (negative = towards the back/left). */
  standX: -0.2,
  standZ: -0.03,
};

/**
 * The standard scene: three copies lying flat in a loose pile (covers up, page edges showing), each nudged towards the front-left of
 * the one below it and turned a few degrees, and one copy standing on top of the pile, leaning back, turned so its front cover, its
 * spine and the top of its pages can all be seen.
 */
export function standardScene(standing: Omit<Placement, "x" | "z" | "yaw" | "lying" | "lift" | "order">, flat: Omit<Placement, "x" | "z" | "yaw" | "lying" | "lift" | "order">): Placement[] {
  const L = SCENE_LAYOUT;
  const w = standing.dims.w, h = flat.dims.h, ft = flat.dims.t;
  // The offsets are given in the pile's own directions, then turned with the pile.
  const out: Placement[] = [0, 1, 2].map((i) => {
    const local: V3 = [L.stepX * (2 - i), 0, L.stepZ * (2 - i)];
    const turned = rotY(local, 0);
    return { ...flat, lying: true, yaw: L.stackYaw + L.stackJitter[i], x: turned[0], z: turned[2], lift: ft * i, order: i };
  });
  out.push({ ...standing, lying: false, yaw: L.standYaw, tilt: L.standTilt, x: w * L.standX, z: h * L.standZ, lift: ft * 3, order: 3 });
  return out;
}
