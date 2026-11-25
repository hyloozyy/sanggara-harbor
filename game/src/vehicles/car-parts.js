// Shared building blocks for vehicle meshes. Every static, non-glowing part of a vehicle (trim,
// chrome, rubber, interior, grille, brake parts, rims...) is drawn with ONE material that reads
// its colour from vertex colours and its roughness/metalness from a per-vertex `rm` attribute,
// so a whole car's details merge into a single draw call. PartList collects pieces with their
// finish and transform and bakes them into one BufferGeometry; geometries are built once per
// model and shared between every car of that model.
import * as THREE from 'three';
import { makeCanvas } from '../assets/canvas-tools.js';
import { weatherizeMaterial } from '../render/surface-weather.js';

// ------------------------------------------------------------------ finishes
// [hex, roughness, metalness]
export const FIN = {
  trim: [0x101113, 0.5, 0.15],         // satin black plastic
  gloss: [0x060708, 0.12, 0.3],        // piano black (pillars, grille surround)
  chrome: [0xcfd3d7, 0.13, 1],
  alloy: [0xc4c8cc, 0.24, 1],
  darkAlloy: [0x45494e, 0.3, 1],
  rubber: [0x161616, 0.88, 0],
  tread: [0x101010, 0.95, 0],
  disc: [0x8a8c8e, 0.38, 0.95],
  discHat: [0x3a3b3c, 0.6, 0.6],
  caliperRed: [0xb0141a, 0.35, 0.1],
  caliperGrey: [0x4a4d52, 0.45, 0.6],
  caliperYellow: [0xd8a010, 0.35, 0.1],
  seat: [0x2a2a2c, 0.8, 0],
  seatTan: [0x6a4a32, 0.65, 0],
  dash: [0x1a1a1c, 0.7, 0],
  headliner: [0x8e8a84, 0.95, 0],
  interior: [0x2c2c2e, 0.85, 0],
  reflector: [0xd8dade, 0.15, 1],
  lampInner: [0x2a2c30, 0.25, 0.8],
  amber: [0xe07a10, 0.2, 0],
  reverse: [0xe8e8e8, 0.1, 0],
  redLens: [0x5a0608, 0.15, 0],
  mesh: [0x1a1b1d, 0.55, 0.4],
  steel: [0x8a8e94, 0.4, 0.9],
  bedLiner: [0x1b1b1c, 0.92, 0],
  white: [0xe8e6e0, 0.45, 0.2],
  canvas: [0x1d1d1d, 0.9, 0],
  vinyl: [0x5a3a26, 0.7, 0],
  mirror: [0xc8d0d8, 0.02, 1],
  exhaust: [0xb8bcc0, 0.2, 1],
  engine: [0x3a3c40, 0.5, 0.7],
  frame: [0x2a2c30, 0.4, 0.6],
};

// ------------------------------------------------------------------ the multi material
let tread = null;
function treadNormal() {
  if (tread) return tread;
  // Left half: tread blocks (tiles vertically); right half: flat (for every other part).
  const w = 128, h = 128, c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, w, h);
  const hgt = makeCanvas(64, h), hg = hgt.getContext('2d');
  hg.fillStyle = '#fff'; hg.fillRect(0, 0, 64, h);
  hg.fillStyle = '#000';
  for (let y = 0; y < h; y += 16) {
    // Chevron sipes and lateral grooves.
    hg.save(); hg.translate(0, y);
    hg.beginPath(); hg.moveTo(2, 2); hg.lineTo(30, 9); hg.lineTo(30, 12); hg.lineTo(2, 5); hg.fill();
    hg.beginPath(); hg.moveTo(62, 2); hg.lineTo(34, 9); hg.lineTo(34, 12); hg.lineTo(62, 5); hg.fill();
    hg.restore();
  }
  const src = hg.getImageData(0, 0, 64, h).data, img = g.getImageData(0, 0, w, h);
  const H = (x, y) => src[((((y % h) + h) % h) * 64 + Math.max(0, Math.min(63, x))) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < 64; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * 2.5, dy = (H(x, y + 1) - H(x, y - 1)) * 2.5;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * w + x) * 4;
    img.data[i] = 128 - dx / l * 127; img.data[i + 1] = 128 - dy / l * 127; img.data[i + 2] = 255 / l;
  }
  g.putImageData(img, 0, 0);
  tread = new THREE.CanvasTexture(c);
  tread.wrapS = THREE.ClampToEdgeWrapping; tread.wrapT = THREE.RepeatWrapping;
  tread.colorSpace = THREE.NoColorSpace;
  return tread;
}
export const FLAT_UV = [0.85, 0.5];

const mats = new Map();
export function multiMaterial(kind = 'parts') {
  if (mats.has(kind)) return mats.get(kind);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, envMapIntensity: 1.1 });
  if (kind === 'wheel') { m.normalMap = treadNormal(); m.normalScale = new THREE.Vector2(1.2, 1.2); }
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 rm;\nvarying vec2 vRM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = rm;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vRM;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vRM.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;');
  };
  m.customProgramCacheKey = () => 'car-multi-' + kind;
  weatherizeMaterial(m, { wet: 0.5, snow: 0.6 });
  mats.set(kind, m);
  return m;
}

// ------------------------------------------------------------------ part lists
const tmpV = new THREE.Vector3(), tmpN = new THREE.Vector3(), tmpM3 = new THREE.Matrix3();

export class PartList {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.rm = []; this.idx = []; }
  get count() { return this.pos.length / 3; }

  // Append a geometry with a finish ([hex, rough, metal] or a FIN key) and optional matrix.
  add(geo, fin, matrix = null, { flip = false, keepUV = false } = {}) {
    const f = typeof fin === 'string' ? FIN[fin] : fin;
    const c = new THREE.Color(f[0]);
    const g = geo.index ? geo : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const base = this.count;
    if (matrix) tmpM3.getNormalMatrix(matrix);
    const det = matrix ? matrix.determinant() : 1;
    for (let i = 0; i < p.count; i++) {
      tmpV.fromBufferAttribute(p, i); tmpN.fromBufferAttribute(n, i);
      if (matrix) { tmpV.applyMatrix4(matrix); tmpN.applyMatrix3(tmpM3).normalize(); }
      if (flip) tmpN.negate();
      this.pos.push(tmpV.x, tmpV.y, tmpV.z); this.nor.push(tmpN.x, tmpN.y, tmpN.z);
      if (keepUV && uv) this.uv.push(uv.getX(i), uv.getY(i)); else this.uv.push(FLAT_UV[0], FLAT_UV[1]);
      this.col.push(c.r, c.g, c.b); this.rm.push(f[1], f[2]);
    }
    const ix = g.index ? Array.from(g.index.array) : [...Array(p.count).keys()];
    const rev = (det < 0) !== flip;
    for (let i = 0; i < ix.length; i += 3) {
      if (rev) this.idx.push(base + ix[i], base + ix[i + 2], base + ix[i + 1]);
      else this.idx.push(base + ix[i], base + ix[i + 1], base + ix[i + 2]);
    }
    return this;
  }

  // Raw triangles: points [[x,y,z]...], normals, triangles as index triplets.
  addRaw(points, normals, tris, fin, uvs = null) {
    const f = typeof fin === 'string' ? FIN[fin] : fin;
    const c = new THREE.Color(f[0]);
    const base = this.count;
    points.forEach((p, i) => {
      this.pos.push(p[0], p[1], p[2]);
      const n = normals[i]; this.nor.push(n[0], n[1], n[2]);
      if (uvs) this.uv.push(uvs[i][0], uvs[i][1]); else this.uv.push(FLAT_UV[0], FLAT_UV[1]);
      this.col.push(c.r, c.g, c.b); this.rm.push(f[1], f[2]);
    });
    for (const t of tris) this.idx.push(base + t[0], base + t[1], base + t[2]);
    return this;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('rm', new THREE.Float32BufferAttribute(this.rm, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// Plain geometry (position/normal/uv) from raw arrays, e.g. for emissive lamp lenses.
export function rawGeometry(points, normals, tris, uvs = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals.flat(), 3));
  if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
  g.setIndex(tris.flat());
  g.computeBoundingSphere();
  return g;
}

export const mat4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));

// ------------------------------------------------------------------ primitives (cached)
const prim = new Map();
const cachedGeo = (key, make) => { if (!prim.has(key)) prim.set(key, make()); return prim.get(key); };

// Rounded box centred on the origin.
export function roundBox(sx, sy, sz, r = 0.03, seg = 1) {
  return cachedGeo(`rb:${sx.toFixed(3)}:${sy.toFixed(3)}:${sz.toFixed(3)}:${r}:${seg}`, () => {
    r = Math.min(r, sx / 2 - 1e-3, sy / 2 - 1e-3, sz / 2 - 1e-3);
    const s = new THREE.Shape(), w = sz / 2 - r, h = sy / 2 - r;
    s.moveTo(-w, -sy / 2); s.lineTo(w, -sy / 2); s.absarc(w, -h, r, -Math.PI / 2, 0); s.lineTo(sz / 2, h); s.absarc(w, h, r, 0, Math.PI / 2);
    s.lineTo(-w, sy / 2); s.absarc(-w, h, r, Math.PI / 2, Math.PI); s.lineTo(-sz / 2, -h); s.absarc(-w, -h, r, Math.PI, Math.PI * 1.5);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-3, sx - 2 * r), bevelEnabled: true, bevelSize: r * 0.98, bevelThickness: r, bevelSegments: seg, curveSegments: seg + 1 });
    g.translate(0, 0, -Math.max(1e-3, sx - 2 * r) / 2);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  });
}
export const boxGeo = (sx, sy, sz) => cachedGeo(`b:${sx}:${sy}:${sz}`, () => new THREE.BoxGeometry(sx, sy, sz));
export const cylGeo = (r0, r1, h, seg = 12, open = false) => cachedGeo(`c:${r0}:${r1}:${h}:${seg}:${open}`, () => new THREE.CylinderGeometry(r0, r1, h, seg, 1, open));
export const sphereGeo = (r, ws = 12, hs = 8) => cachedGeo(`s:${r}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const torusGeo = (R, r, rs = 6, ts = 20, arc = Math.PI * 2) => cachedGeo(`t:${R}:${r}:${rs}:${ts}:${arc}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc));

// A tube along a list of points (smooth Catmull-Rom path).
export function tubeGeo(points, r, seg = 16, rs = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, seg, r, rs, false);
}

// A smooth closed shell lofted along z through elliptical sections [z, cy, rx, ry, (cx)].
export function ellipseLoft(sections, segs = 14, { power = 2 } = {}) {
  const pos = [], idx = [];
  for (const [z, cy, rx, ry, cx = 0] of sections) {
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      // Superellipse for boxier sections when power > 2.
      const e = 2 / power;
      pos.push(cx + Math.sign(c) * Math.pow(Math.abs(c), e) * rx, cy + Math.sign(s) * Math.pow(Math.abs(s), e) * ry, z);
    }
  }
  const n = sections.length;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < segs; j++) {
    const a = i * segs + j, b = i * segs + (j + 1) % segs, c = a + segs, d = b + segs;
    idx.push(a, c, b, b, c, d);
  }
  for (const [ri, flip] of [[0, true], [n - 1, false]]) {
    const ci = pos.length / 3, s = sections[ri];
    pos.push(s[4] ?? 0, s[1], s[0]);
    for (let j = 0; j < segs; j++) { const a = ri * segs + j, b = ri * segs + (j + 1) % segs; idx.push(...(flip ? [ci, b, a] : [ci, a, b])); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Mirror a geometry across x = 0 (keeps the winding correct).
export function mirrorX(geo) {
  const g = geo.clone();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); if (n) n.setX(i, -n.getX(i)); }
  const ix = g.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  return g;
}

// ------------------------------------------------------------------ wheels
// One road wheel around the x axis, outer face towards +x: a tyre with rounded sidewalls,
// circumferential grooves and a tread pattern, a multi-spoke alloy (or steel) rim with a
// barrel, lip, centre cap and lug nuts, and a ventilated brake disc behind the spokes.
// style: { spokes, rimRatio, finish, steel, twin, seg }
export function wheelGeometry(r, w, style = {}) {
  const key = `wheel:${r.toFixed(3)}:${w.toFixed(3)}:${JSON.stringify(style)}`;
  return cachedGeo(key, () => {
    const seg = style.seg ?? 26, lowDetail = seg < 20;
    const ri = r * (style.rimRatio ?? 0.66);
    const L = new PartList();
    // Tyre profile (radius, axial) from the inner bead round to the outer bead.
    const prof = [];
    const side = (k) => { // k = -1 inner, +1 outer
      const out = [[ri + 0.006, k * w * 0.4], [ri + (r - ri) * 0.18, k * w * 0.47], [ri + (r - ri) * 0.5, k * w * 0.5], [ri + (r - ri) * 0.8, k * w * 0.485], [r - 0.012, k * w * 0.44], [r - 0.002, k * w * 0.39]];
      return k < 0 ? out : out.reverse();
    };
    prof.push(...side(-1));
    const grooves = lowDetail ? [] : [-0.22, 0, 0.22];
    let a = -w * 0.36;
    prof.push([r, a]);
    for (const gz of grooves) { const c = gz * w; prof.push([r, c - 0.022], [r - 0.009, c - 0.016], [r - 0.009, c + 0.016], [r, c + 0.022]); }
    prof.push([r, w * 0.36]);
    prof.push(...side(1));
    // Lathe around the x axis with custom UVs (tread samples the left half of the normal map).
    const pts = [], nors = [], uvs = [], tris = [];
    const np = prof.length;
    const treadLo = r - 0.01;
    for (let s = 0; s <= seg; s++) {
      const th = (s / seg) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      for (let i = 0; i < np; i++) {
        const [rad, ax] = prof[i];
        pts.push([ax, rad * c, rad * sn]);
        // Profile normal in (radial, axial).
        const p0 = prof[Math.max(0, i - 1)], p1 = prof[Math.min(np - 1, i + 1)];
        let dr = p1[0] - p0[0], da = p1[1] - p0[1];
        const l = Math.hypot(dr, da) || 1; dr /= l; da /= l;
        const nr = da, na = -dr; // rotate tangent
        nors.push([na, nr * c, nr * sn]);
        const onTread = rad >= treadLo && Math.abs(ax) < w * 0.37;
        uvs.push(onTread ? [0.02 + (ax / (w * 0.74) + 0.5) * 0.46, (s / seg) * Math.round(r * 40)] : FLAT_UV);
      }
    }
    for (let s = 0; s < seg; s++) for (let i = 0; i < np - 1; i++) {
      const a0 = s * np + i, b0 = a0 + np;
      tris.push([a0, a0 + 1, b0], [a0 + 1, b0 + 1, b0]);
    }
    // Make sure the normals point outwards (radially at the tread).
    const probe = prof.findIndex((p) => p[0] === r);
    if (nors[probe][1] < 0) for (const n of nors) { n[0] = -n[0]; n[1] = -n[1]; n[2] = -n[2]; }
    const testN = new THREE.Vector3(...nors[probe]), e1 = new THREE.Vector3(...pts[probe + 1]).sub(new THREE.Vector3(...pts[probe])), e2 = new THREE.Vector3(...pts[probe + np]).sub(new THREE.Vector3(...pts[probe]));
    if (e1.cross(e2).dot(testN) < 0) for (const t of tris) { const q = t[1]; t[1] = t[2]; t[2] = q; }
    // Sidewalls a touch lighter than the tread.
    const tyreCols = pts.map((p, i) => (uvs[i] === FLAT_UV ? FIN.rubber : FIN.tread));
    const base = L.count;
    L.addRaw(pts, nors, tris, 'rubber', uvs);
    tyreCols.forEach((f, i) => { const c = new THREE.Color(f[0]); L.col[(base + i) * 3] = c.r; L.col[(base + i) * 3 + 1] = c.g; L.col[(base + i) * 3 + 2] = c.b; L.rm[(base + i) * 2] = f[1]; });

    const rimF = style.finish ?? 'alloy';
    const faceX = w * 0.36;
    // Barrel (inside of the rim, seen through the spokes) and the outer lip.
    L.add(cylGeo(ri - 0.004, ri - 0.004, w * 0.78, seg, true), 'darkAlloy', mat4(-w * 0.02, 0, 0, 0, 0, Math.PI / 2), { flip: true });
    L.add(torusGeo(ri - 0.004, 0.011, 5, seg), rimF, mat4(faceX, 0, 0, 0, Math.PI / 2, 0));
    L.add(torusGeo(ri - 0.02, 0.007, 4, seg), rimF, mat4(faceX - 0.012, 0, 0, 0, Math.PI / 2, 0));
    // Spokes from the hub to the lip with a little concave dish.
    const n = style.spokes ?? 5, rh = ri * 0.27;
    if (style.steel) {
      L.add(cylGeo(ri * 0.92, ri * 0.92, 0.012, seg), rimF, mat4(faceX - 0.03, 0, 0, 0, 0, Math.PI / 2));
      for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; L.add(cylGeo(0.022, 0.022, 0.016, 8), 'trim', mat4(faceX - 0.024, Math.cos(t) * ri * 0.6, Math.sin(t) * ri * 0.6, 0, 0, Math.PI / 2)); }
    } else {
      const twin = style.twin ?? n >= 8;
      const spokeGeo = (() => {
        const s = new THREE.Shape();
        const w0 = twin ? 0.022 : 0.034, w1 = twin ? 0.016 : 0.024;
        s.moveTo(rh * 0.6, -w0); s.lineTo(ri - 0.012, -w1); s.lineTo(ri - 0.012, w1); s.lineTo(rh * 0.6, w0); s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: 0.016, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 1 });
        // Dish: the hub end sits further out than the rim end.
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const rr = p.getX(i), k = 1 - (rr - rh * 0.6) / (ri - rh * 0.6); p.setZ(i, p.getZ(i) + k * w * 0.12); }
        g.computeVertexNormals();
        return g;
      })();
      const count = twin ? Math.ceil(n / 2) : n;
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const offs = twin ? [-0.09, 0.09] : [0];
        for (const o of offs) {
          // Shape is in (radial, tangential); extrusion along +z becomes +x (axial).
          const m = new THREE.Matrix4().makeRotationX(t + o).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
          m.premultiply(new THREE.Matrix4().makeTranslation(faceX - 0.03 - 0.016, 0, 0));
          L.add(spokeGeo, rimF, m);
        }
      }
    }
    // Hub, centre cap and lug nuts.
    L.add(cylGeo(rh, rh * 1.05, 0.05, 16), rimF, mat4(faceX - 0.01 + w * 0.1, 0, 0, 0, 0, Math.PI / 2));
    L.add(cylGeo(rh * 0.55, rh * 0.6, 0.012, 14), 'gloss', mat4(faceX + w * 0.1 + 0.016, 0, 0, 0, 0, Math.PI / 2));
    if (!lowDetail) for (let i = 0; i < 5; i++) { const t = (i / 5) * Math.PI * 2; L.add(cylGeo(0.009, 0.009, 0.016, 6), 'chrome', mat4(faceX + w * 0.1 + 0.012, Math.cos(t) * rh * 0.75, Math.sin(t) * rh * 0.75, 0, 0, Math.PI / 2)); }
    // Brake disc with a darker hat, inboard of the spokes.
    if (!style.noDisc) {
      const rd = ri * 0.84;
      L.add(cylGeo(rd, rd, 0.024, seg), 'disc', mat4(-w * 0.06, 0, 0, 0, 0, Math.PI / 2));
      L.add(cylGeo(rd * 0.5, rd * 0.5, 0.04, 16), 'discHat', mat4(-w * 0.04, 0, 0, 0, 0, Math.PI / 2));
    }
    const geo = L.build();
    return geo;
  });
}

// Brake caliper hugging the top-rear of the disc (does not spin).
export function caliperGeometry(r, w, ri, fin = 'caliperGrey') {
  return cachedGeo(`caliper:${r}:${w}:${ri}:${fin}`, () => {
    const L = new PartList();
    const rd = ri * 0.84;
    L.add(torusGeo(rd * 0.86, 0.032, 4, 5, 0.9), fin, mat4(-w * 0.06 + 0.012, 0, 0, 0, Math.PI / 2, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI * 0.55)), {});
    return L.build();
  });
}
